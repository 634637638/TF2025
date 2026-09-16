<template>
  <div class="supplier-phone-payments-view admin-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="payments"
      module-name="供应商打款"
      permission-code="supplier-payments:view"
    >
      <!-- 权限验证通过后的内容 -->
      <div class="admin-page-content">
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
            <el-button
              type="info"
              :disabled="refreshing"
              @click="() => refreshData()"
            >
              <InlineLoading
                v-if="refreshing"
                text="刷新中..."
                size="small"
                variant="inherit"
              />
              <template v-else>
                <i class="fas fa-sync-alt" />
                <span>刷新</span>
              </template>
            </el-button>
          </template>
        </PageHeader>

        <!-- 统计卡片 - 重新设计 -->
        <div
          v-if="showPaymentStatsCards"
          class="stats-cards"
        >
          <!-- 主要统计 - 3个关键指标 -->
          <div
            v-if="canViewPaymentField('stats_unpaid_count')"
            class="stat-card stat-card--warning"
          >
            <div class="stat-icon">
              <i class="fas fa-clock" />
            </div>
            <div class="stat-content">
              <div class="stat-main-line">
                <div class="stat-label">
                  待打款
                </div>
                <div class="stat-value-primary">
                  {{ currentUnpaidCount || 0 }}台
                </div>
              </div>
              <div
                v-if="showPaymentStatsAmount"
                class="stat-sub"
              >
                金额 ¥{{ formatAmount(currentUnpaidAmount || 0) }}
              </div>
            </div>
          </div>

          <div
            v-if="canViewPaymentField('stats_paid_count')"
            class="stat-card stat-card--income"
          >
            <div class="stat-icon">
              <i class="fas fa-check-double" />
            </div>
            <div class="stat-content">
              <div class="stat-main-line">
                <div class="stat-label">
                  已打款
                </div>
                <div class="stat-value-primary">
                  {{ currentPaidCount || 0 }}台
                </div>
              </div>
              <div
                v-if="showPaymentStatsAmount"
                class="stat-sub"
              >
                金额 ¥{{ formatAmount(currentPaidAmount || 0) }}
              </div>
            </div>
          </div>

          <div
            v-if="canViewPaymentField('stats_total_count')"
            class="stat-card stat-card--primary"
          >
            <div class="stat-icon">
              <i class="fas fa-mobile-alt" />
            </div>
            <div class="stat-content">
              <div class="stat-main-line">
                <div class="stat-label">
                  手机总数
                </div>
                <div class="stat-value-primary">
                  {{ currentTotalCount || 0 }}台
                </div>
              </div>
              <div
                v-if="showPaymentStatsAmount"
                class="stat-sub"
              >
                金额 ¥{{ formatAmount(currentTotalAmount || 0) }}
              </div>
            </div>
          </div>

          <div
            v-if="canViewPaymentField('supplier_name')"
            class="stat-card stat-card--info"
          >
            <div class="stat-icon">
              <i class="fas fa-truck-loading" />
            </div>
            <div class="stat-content">
              <div class="stat-main-line">
                <div class="stat-label">
                  供应商
                </div>
                <div class="stat-value-primary">
                  {{ currentSupplierCount || 0 }}家
                </div>
              </div>
              <div class="stat-sub">
                {{ currentSupplierMeta }}
              </div>
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
              placeholder="搜索 IMEI、序列号、品牌、型号"
              clearable
              @keyup.enter="handleFilterChange"
              @clear="clearKeyword"
              @click.stop
            >
              <template #prefix>
                <i class="fas fa-search" />
              </template>
            </el-input>
          </template>

          <div
            v-if="canViewPaymentField('supplier_name')"
            class="form-group filter-item"
            data-field="supplier"
          >
            <el-select
              v-model="filters.supplier_id"
              placeholder="供应商"
              clearable
              filterable
              @change="handleFilterChange"
              @clear="handleFilterChange"
            >
              <el-option
                v-for="stat in statistics"
                :key="stat.supplier_id"
                :label="`${stat.supplier_name} (待打款${stat.unpaid_count}台)`"
                :value="stat.supplier_id"
              />
            </el-select>
          </div>

          <div
            v-if="canViewPaymentField('sale_status')"
            class="form-group filter-item"
            data-field="sale_status"
          >
            <el-select
              v-model="filters.sale_status"
              placeholder="销售状态"
              clearable
              @change="handleFilterChange"
              @clear="handleFilterChange"
            >
              <el-option
                label="全部"
                value="all"
              />
              <el-option
                label="已售"
                value="sold"
              />
              <el-option
                label="在库"
                value="stock"
              />
            </el-select>
          </div>

          <div
            v-if="canViewPaymentField('payment_status')"
            class="form-group filter-item"
            data-field="payment_status"
          >
            <el-select
              v-model="filters.payment_status"
              placeholder="打款状态"
              clearable
              @change="handleFilterChange"
              @clear="handleFilterChange"
            >
              <el-option
                label="全部"
                value="all"
              />
              <el-option
                label="未打款"
                value="unpaid"
              />
              <el-option
                label="已打款"
                value="paid"
              />
            </el-select>
          </div>

          <div
            v-if="canViewPaymentField('store_name')"
            class="form-group filter-item"
            data-field="store"
          >
            <el-select
              v-model="filters.store_id"
              placeholder="店铺"
              clearable
              filterable
              @change="handleFilterChange"
              @clear="handleFilterChange"
            >
              <el-option
                v-for="store in stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
          </div>

          <div
            v-if="canViewPaymentField('sale_time')"
            class="form-group filter-item"
            data-field="start_date"
          >
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

          <div
            v-if="canViewPaymentField('sale_time')"
            class="form-group filter-item"
            data-field="end_date"
          >
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
              <i class="fas fa-list" />
              <span class="title-text">手机列表</span>
            </div>
            <span class="record-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div
            v-if="selectedPhones.length > 0"
            class="selected-info"
          >
            <div class="selected-summary">
              <span class="selected-count">已选择 {{ selectedPhones.length }} 台手机</span><span
                v-if="canViewPaymentField('purchase_cost')"
                class="selected-amount"
              >总计: ¥{{ Number(selectedTotalAmount || 0) }}</span>
            </div>
            <el-button
              type="danger"
              class="selected-action-btn selected-action-btn-danger"
              @click.stop="clearSelection"
            >
              <i class="fas fa-times" /> 清空选择
            </el-button>
            <el-button
              v-if="canCreatePayment"
              type="primary"
              class="selected-action-btn selected-action-btn-primary"
              @click="handleOpenBatchPaymentDialog"
            >
              <i class="fas fa-money-bill-wave" />
              批量打款
            </el-button>
          </div>

          <div class="table-responsive payment-list-table-wrapper">
            <el-table
              :data="loading ? [] : phones"
              border
              stripe
              class="data-table devices-table supplier-payment-table"
              table-layout="fixed"
              :fit="true"
              row-key="id"
              :row-class-name="getPaymentRowClassName"
              @row-click="(row) => handlePaymentMobileRowTap(row.id)"
              @row-dblclick="(row) => togglePaymentMobileActions(row.id)"
            >
              <el-table-column
                :width="isMobile ? 42 : 60"
                align="center"
                class-name="selection-col"
              >
                <template #header>
                  <input
                    type="checkbox"
                    :checked="isCurrentPageAllSelected"
                    :indeterminate.prop="isCurrentPagePartiallySelected"
                    :disabled="currentPageSelectableIds.length === 0"
                    aria-label="选择当前页全部未打款手机"
                    @click.stop
                    @change="handleSelectAll"
                  >
                </template>
                <template #default="{ row }">
                  <input
                    type="checkbox"
                    :checked="selectedPhones.includes(row.id)"
                    :disabled="row.payment_status === 'paid'"
                    :aria-label="`选择手机 ${row.serial_number || row.id}`"
                    @click.stop
                    @change="handlePhoneSelectionChange(row, $event)"
                  >
                </template>
              </el-table-column>
              <el-table-column
                label="序号"
                :width="isMobile ? 50 : 70"
                align="center"
              >
                <template #default="{ $index }">
                  <span class="index-badge">{{ (pagination.page - 1) * pagination.page_size + $index + 1 }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('supplier_name')"
                prop="supplier_name"
                label="供应商"
                :min-width="paymentSupplierColumnWidth"
                align="center"
                class-name="complete-text-column col-supplier"
              >
                <template #default="{ row }">
                  {{ row.supplier_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('store_name')"
                prop="store_name"
                label="店铺"
                :min-width="paymentStoreColumnWidth"
                align="center"
                class-name="complete-text-column"
              >
                <template #default="{ row }">
                  {{ row.store_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('brand_name')"
                prop="brand_name"
                label="品牌"
                :min-width="paymentBrandColumnWidth"
                align="center"
                class-name="complete-text-column"
              >
                <template #default="{ row }">
                  {{ row.brand_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('model_name')"
                prop="model_name"
                label="型号"
                :min-width="paymentModelColumnWidth"
                align="center"
                class-name="complete-text-column col-model"
              >
                <template #default="{ row }">
                  {{ row.model_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('color_name')"
                prop="color_name"
                label="颜色"
                :min-width="paymentColorColumnWidth"
                align="center"
                class-name="complete-text-column col-color"
              >
                <template #default="{ row }">
                  {{ row.color_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('memory_name')"
                prop="memory_name"
                label="内存"
                :min-width="paymentMemoryColumnWidth"
                align="center"
                class-name="complete-text-column col-memory"
              >
                <template #default="{ row }">
                  {{ row.memory_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('serial_number')"
                label="序列号"
                :min-width="paymentSerialColumnWidth"
                align="center"
                class-name="identifier-column col-serial"
              >
                <template #default="{ row }">
                  <span class="serial-number">{{ row.serial_number || '-' }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('imei')"
                label="IMEI"
                :min-width="paymentImeiColumnWidth"
                align="center"
                class-name="identifier-column col-imei"
              >
                <template #default="{ row }">
                  <span :class="['imei', row.phone_status === 'peer_transfer' ? 'admin-wholesale-text' : '']">{{ row.imei || '-' }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('purchase_cost')"
                label="入库价格"
                :min-width="paymentPurchaseCostColumnWidth"
                align="center"
                class-name="complete-text-column"
              >
                <template #default="{ row }">
                  <span class="price">¥{{ formatAmount(row.purchase_cost) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('sale_price')"
                label="销售价格"
                :min-width="paymentSalePriceColumnWidth"
                align="center"
                class-name="complete-text-column"
              >
                <template #default="{ row }">
                  <span class="price">¥{{ formatAmount(row.sale_price) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('profit')"
                label="利润"
                :min-width="paymentProfitColumnWidth"
                align="center"
                class-name="complete-text-column"
              >
                <template #default="{ row }">
                  <span :class="['price-cell', getPhoneProfit(row) >= 0 ? 'profit-positive' : 'profit-negative']">
                    ¥{{ formatAmount(getPhoneProfit(row)) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('sale_time')"
                label="入库时间"
                :min-width="paymentPurchaseDateColumnWidth"
                align="center"
                class-name="time-cell complete-text-column"
              >
                <template #default="{ row }">
                  {{ formatDate(row.inventory_time) }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="shouldShowPaymentColumn('sale_time')"
                label="销售时间"
                :min-width="paymentSaleDateColumnWidth"
                align="center"
                class-name="time-cell complete-text-column"
              >
                <template #default="{ row }">
                  {{ formatDate(row.sale_time) }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="showPaymentStatusField"
                label="打款状态"
                :min-width="paymentStatusColumnWidth"
                align="center"
                class-name="col-status"
              >
                <template #default="{ row }">
                  <span
                    v-if="canViewPaymentField('payment_status')"
                    :class="['status-badge', row.payment_status === 'paid' ? 'status-paid' : 'status-unpaid']"
                  >
                    {{ row.payment_status === 'paid' ? '已打款' : '未打款' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showPaymentTimeColumn"
                label="打款时间"
                :min-width="paymentTimeColumnWidth"
                align="center"
                class-name="time-cell payment-time-column"
              >
                <template #default="{ row }">
                  <div
                    v-if="row.payment_status === 'paid' && row.payment_time"
                    class="time-badge payment-time-badge"
                    :style="getPaymentTimeStyle(row)"
                    title="点击查看详情"
                    @click.stop="handleShowPaymentDetails(row)"
                  >
                    <i class="fas fa-clock" />
                    {{ formatDateTimeBeijing(row.payment_time) }}
                  </div>
                  <el-button
                    v-else-if="canCreatePayment && row.payment_status === 'unpaid'"
                    class="table-inline-action table-action--success payment-time-action"
                    type="success"
                    size="small"
                    @click.stop="handleSinglePayment(row)"
                  >
                    <i class="fas fa-money-bill-wave" />
                    <span>打款</span>
                  </el-button>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showPaymentActionField"
                label="操作"
                :width="paymentActionColumnWidth"
                align="center"
                class-name="actions-column"
              >
                <template #default="{ row }">
                  <div
                    v-if="row.payment_status !== 'unpaid'"
                    class="action-buttons"
                  >
                    <el-button
                      v-if="canViewPayments"
                      type="primary"
                      size="small"
                      @click.stop="handleShowPaymentDetails(row)"
                    >
                      <i class="fas fa-eye" />
                      <span>查看</span>
                    </el-button>
                    <el-button
                      v-if="canEditPayment"
                      type="warning"
                      size="small"
                      @click.stop="handleEditPayment(row)"
                    >
                      <i class="fas fa-edit" />
                      <span>编辑</span>
                    </el-button>
                    <el-button
                      v-if="canDeletePayment"
                      type="danger"
                      size="small"
                      class="table-action table-action--delete"
                      title="取消打款"
                      :disabled="removingPayment"
                      @click.stop="handleCancelPayment(row)"
                    >
                      <i class="fas fa-times-circle" />
                      <span>取消打款</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>

              <template #empty>
                <TableLoadingRow
                  v-if="loading"
                  mode="block"
                  text="加载中..."
                />
                <div
                  v-else
                  class="text-center text-muted"
                >
                  <i class="fas fa-inbox" /> 暂无数据
                </div>
              </template>
            </el-table>

            <!-- 分页 - 使用统一的 Pagination 组件 -->
            <div class="pagination-wrapper">
              <Pagination
                v-model:current="pagination.page"
                v-model:page-size="pagination.page_size"
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
          <div
            ref="batchPaymentTableForCapture"
            class="payment-details"
          >
            <!-- 手机信息摘要 -->
            <div
              class="details-info payment-summary-cards payment-summary-cards-four"
              style="grid-template-columns: repeat(4, 1fr);"
            >
              <div
                v-if="canViewPaymentField('supplier_name')"
                class="info-row"
              >
                <label>供应商:</label>
                <span>{{ selectedPhoneObjects[0]?.supplier_name || '-' }}</span>
              </div>
              <div class="info-row">
                <label>数量:</label>
                <span class="highlight">{{ selectedPhones.length }} 台</span>
              </div>
              <div
                v-if="canViewPaymentField('purchase_cost')"
                class="info-row"
              >
                <label>价格:</label>
                <span class="amount">¥{{ formatAmount(selectedTotalAmount) }}</span>
              </div>
              <div
                v-if="canViewPaymentField('profit') && !isPaymentImageCaptureMode"
                class="info-row hide-in-capture"
              >
                <label>利润:</label>
                <span :class="['amount', selectedTotalProfit >= 0 ? 'profit-positive' : 'profit-negative']">
                  ¥{{ formatAmount(selectedTotalProfit) }}
                </span>
              </div>
            </div>

            <!-- 手机明细表格 - 显示所有待打款手机的完整信息 -->
            <div class="batch-details-table">
              <div class="table-responsive payment-dialog-table-container">
                <el-table
                  :data="selectedPhoneObjects"
                  border
                  stripe
                  class="data-table devices-table payment-detail-table"
                  table-layout="fixed"
                  :fit="true"
                  row-key="id"
                  :row-class-name="getPaymentDialogRowClassName"
                  :cell-class-name="getPaymentDialogCellClassName"
                >
                  <el-table-column
                    label="序号"
                    width="60"
                    align="center"
                  >
                    <template #default="{ $index }">
                      <span class="index-badge">{{ $index + 1 }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('supplier_name')"
                    prop="supplier_name"
                    label="供应商"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'supplier_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.supplier_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('sale_time')"
                    label="销售时间"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'sale_time')"
                    align="center"
                    class-name="time-cell"
                  >
                    <template #default="{ row }">
                      {{ formatDateBeijing(row.sale_time) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('store_name')"
                    prop="store_name"
                    label="店铺"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'store_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.store_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('brand_name')"
                    prop="brand_name"
                    label="品牌"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'brand_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.brand_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('model_name')"
                    prop="model_name"
                    label="型号"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'model_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.model_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('color_name')"
                    prop="color_name"
                    label="颜色"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'color_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.color_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('memory_name')"
                    prop="memory_name"
                    label="内存"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'memory_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.memory_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('serial_number')"
                    label="序列号"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'serial_number')"
                    align="center"
                    class-name="identifier-column serial-imei-column"
                  >
                    <template #default="{ row }">
                      <span class="serial-number">{{ row.serial_number || '-' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('imei')"
                    label="IMEI"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'imei')"
                    align="center"
                    class-name="identifier-column serial-imei-column"
                  >
                    <template #default="{ row }">
                      <span :class="['imei', row.phone_status === 'peer_transfer' ? 'admin-wholesale-text' : '']">{{ row.imei || '-' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('purchase_cost')"
                    label="入库价格"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'purchase_cost')"
                    align="center"
                  >
                    <template #default="{ row }">
                      <span class="price">¥{{ formatAmount(row.purchase_cost) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('profit') && !isPaymentImageCaptureMode"
                    label="利润"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'profit')"
                    align="center"
                    class-name="hide-in-capture"
                  >
                    <template #default="{ row }">
                      <span :class="['price-cell', 'hide-in-capture', getPhoneProfit(row) >= 0 ? 'profit-positive' : 'profit-negative']">
                        ¥{{ formatAmount(getPhoneProfit(row)) }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('payment_time')"
                    label="打款时间"
                    :min-width="getPaymentDialogColumnWidth(selectedPhoneObjects, 'payment_time')"
                    align="center"
                    class-name="time-cell"
                  >
                    <template #default="{ row }">
                      <el-tooltip
                        :content="`完整时间：${formatDateTimeBeijing(row.payment_time)}`"
                        placement="top"
                        :disabled="!row.payment_time"
                      >
                        <span class="payment-time-badge">{{ formatDateBeijing(row.payment_time) }}</span>
                      </el-tooltip>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>

            <!-- 打款信息卡片 -->
            <div class="details-info payment-form-cards mt-5">
              <div class="payment-form-heading">
                <span class="payment-form-heading-icon"><i class="fas fa-pen-to-square" /></span>
                <span>
                  <strong>打款信息</strong>
                  <small>确认本次付款记录</small>
                </span>
              </div>
              <div
                v-if="canViewPaymentField('payment_method')"
                class="info-row payment-method-row"
              >
                <label><i class="fas fa-credit-card" />打款方式</label>
                <PaymentMethodSelect
                  v-model="paymentForm.payment_method"
                  variant="settlement"
                  placeholder="请选择打款方式"
                  class="form-control el-select-form-control w-48"
                  :disabled="!canEditPaymentField('payment_method')"
                />
              </div>
              <div
                v-if="canViewPaymentField('payment_time')"
                class="info-row payment-time-row"
              >
                <label><i class="fas fa-calendar-day" />打款时间</label>
                <el-date-picker
                  v-model="paymentForm.payment_time"
                  type="date"
                  placeholder="选择打款时间"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  class="form-control el-date-form-control w-52"
                  :disabled="!canEditPaymentField('payment_time')"
                />
              </div>
              <div
                v-if="canViewPaymentField('remarks')"
                class="info-row payment-remarks-row"
              >
                <label><i class="fas fa-note-sticky" />备注</label>
                <el-input
                  v-model="paymentForm.payment_remarks"
                  type="textarea"
                  :rows="2"
                  maxlength="1000"
                  placeholder="填写本次打款备注（可选）"
                  class="form-control payment-remarks-input"
                  :disabled="!canEditPaymentField('remarks')"
                />
              </div>
              <div
                v-if="canViewPaymentField('payment_operator')"
                class="info-row payment-operator-row"
              >
                <label><i class="fas fa-user-check" />打款人</label>
                <el-input
                  v-model="paymentForm.payment_operator"
                  placeholder="打款人"
                  class="form-control el-input-form-control w-36"
                  readonly
                />
              </div>
            </div>
          </div>

          <template #footer>
            <div class="payment-dialog-footer">
              <el-button
                type="default"
                @click="showBatchPaymentDialog = false"
              >
                取消
              </el-button>
              <el-button
                type="success"
                :loading="savingImage"
                @click="saveBatchPaymentAsImage"
              >
                <span v-if="savingImage">保存中...</span>
                <template v-else>
                  <i class="fas fa-camera" />
                  <span>保存图片</span>
                </template>
              </el-button>
              <el-button
                type="primary"
                :loading="submitting"
                @click="handleBatchPayment"
              >
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
          <div
            ref="singlePaymentForCapture"
            class="payment-details"
          >
            <!-- 手机信息摘要 -->
            <div
              class="details-info payment-summary-cards payment-summary-cards-four"
              style="grid-template-columns: repeat(4, 1fr);"
            >
              <div
                v-if="canViewPaymentField('supplier_name')"
                class="info-row"
              >
                <label>供应商:</label>
                <span>{{ currentPhone?.supplier_name || '-' }}</span>
              </div>
              <div class="info-row">
                <label>数量:</label>
                <span class="highlight">1 台</span>
              </div>
              <div
                v-if="canViewPaymentField('purchase_cost')"
                class="info-row"
              >
                <label>价格:</label>
                <span class="amount">¥{{ formatAmount(currentPhone?.purchase_cost) }}</span>
              </div>
              <div
                v-if="canViewPaymentField('profit') && !isPaymentImageCaptureMode"
                class="info-row hide-in-capture"
              >
                <label>利润:</label>
                <span :class="['amount', getPhoneProfit(currentPhone) >= 0 ? 'profit-positive' : 'profit-negative']">
                  ¥{{ formatAmount(getPhoneProfit(currentPhone)) }}
                </span>
              </div>
            </div>

            <!-- 手机明细表格 - 显示单个手机的完整信息 -->
            <div class="batch-details-table">
              <div class="table-responsive payment-dialog-table-container">
                <el-table
                  :data="currentPhone ? [currentPhone] : []"
                  border
                  stripe
                  class="data-table devices-table payment-detail-table"
                  table-layout="fixed"
                  :fit="true"
                  row-key="id"
                  :row-class-name="getPaymentDialogRowClassName"
                  :cell-class-name="getPaymentDialogCellClassName"
                >
                  <el-table-column
                    label="序号"
                    width="60"
                    align="center"
                  >
                    <template #default>
                      <span class="index-badge">1</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('supplier_name')"
                    prop="supplier_name"
                    label="供应商"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'supplier_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.supplier_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('sale_time')"
                    label="销售时间"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'sale_time')"
                    align="center"
                    class-name="time-cell"
                  >
                    <template #default="{ row }">
                      {{ formatDateBeijing(row.sale_time) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('store_name')"
                    prop="store_name"
                    label="店铺"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'store_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.store_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('brand_name')"
                    prop="brand_name"
                    label="品牌"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'brand_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.brand_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('model_name')"
                    prop="model_name"
                    label="型号"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'model_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.model_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('color_name')"
                    prop="color_name"
                    label="颜色"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'color_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.color_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('memory_name')"
                    prop="memory_name"
                    label="内存"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'memory_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.memory_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('serial_number')"
                    label="序列号"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'serial_number')"
                    align="center"
                    class-name="identifier-column serial-imei-column"
                  >
                    <template #default="{ row }">
                      <span class="serial-number">{{ row.serial_number || '-' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('imei')"
                    label="IMEI"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'imei')"
                    align="center"
                    class-name="identifier-column serial-imei-column"
                  >
                    <template #default="{ row }">
                      <span :class="['imei', row.phone_status === 'peer_transfer' ? 'admin-wholesale-text' : '']">{{ row.imei || '-' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('purchase_cost')"
                    label="入库价格"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'purchase_cost')"
                    align="center"
                  >
                    <template #default="{ row }">
                      <span class="price">¥{{ formatAmount(row.purchase_cost) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('profit') && !isPaymentImageCaptureMode"
                    label="利润"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'profit')"
                    align="center"
                    class-name="hide-in-capture"
                  >
                    <template #default="{ row }">
                      <span :class="['price-cell', 'hide-in-capture', getPhoneProfit(row) >= 0 ? 'profit-positive' : 'profit-negative']">
                        ¥{{ formatAmount(getPhoneProfit(row)) }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('payment_time')"
                    label="打款时间"
                    :min-width="getPaymentDialogColumnWidth(currentPhone ? [currentPhone] : [], 'payment_time')"
                    align="center"
                    class-name="time-cell"
                  >
                    <template #default="{ row }">
                      <el-tooltip
                        :content="`完整时间：${formatDateTimeBeijing(row.payment_time)}`"
                        placement="top"
                        :disabled="!row.payment_time"
                      >
                        <span class="payment-time-badge">{{ formatDateBeijing(row.payment_time) }}</span>
                      </el-tooltip>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>

            <!-- 打款信息卡片 -->
            <div class="details-info payment-form-cards mt-5">
              <div class="payment-form-heading">
                <span class="payment-form-heading-icon"><i class="fas fa-pen-to-square" /></span>
                <span>
                  <strong>打款信息</strong>
                  <small>确认本次付款记录</small>
                </span>
              </div>
              <div
                v-if="canViewPaymentField('payment_method')"
                class="info-row payment-method-row"
              >
                <label><i class="fas fa-credit-card" />打款方式</label>
                <PaymentMethodSelect
                  v-model="paymentForm.payment_method"
                  variant="settlement"
                  placeholder="请选择打款方式"
                  class="form-control el-select-form-control w-48"
                  :disabled="!canEditPaymentField('payment_method')"
                />
              </div>
              <div
                v-if="canViewPaymentField('payment_time')"
                class="info-row payment-time-row"
              >
                <label><i class="fas fa-calendar-day" />打款时间</label>
                <el-date-picker
                  v-model="paymentForm.payment_time"
                  type="date"
                  placeholder="选择打款时间"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  class="form-control el-date-form-control w-52"
                  :disabled="!canEditPaymentField('payment_time')"
                />
              </div>
              <div
                v-if="canViewPaymentField('remarks')"
                class="info-row payment-remarks-row"
              >
                <label><i class="fas fa-note-sticky" />备注</label>
                <el-input
                  v-model="paymentForm.payment_remarks"
                  type="textarea"
                  :rows="2"
                  maxlength="1000"
                  placeholder="填写本次打款备注（可选）"
                  class="form-control payment-remarks-input"
                  :disabled="!canEditPaymentField('remarks')"
                />
              </div>
              <div
                v-if="canViewPaymentField('payment_operator')"
                class="info-row payment-operator-row"
              >
                <label><i class="fas fa-user-check" />打款人</label>
                <el-input
                  v-model="paymentForm.payment_operator"
                  placeholder="打款人"
                  class="form-control el-input-form-control w-36"
                  readonly
                />
              </div>
            </div>
          </div>

          <template #footer>
            <div class="payment-dialog-footer">
              <el-button
                type="default"
                @click="showSinglePaymentDialog = false"
              >
                取消
              </el-button>
              <el-button
                type="success"
                :loading="savingImage"
                @click="saveSinglePaymentAsImage"
              >
                <span v-if="savingImage">保存中...</span>
                <template v-else>
                  <i class="fas fa-camera" />
                  <span>保存图片</span>
                </template>
              </el-button>
              <el-button
                type="primary"
                :loading="submitting"
                @click="handleSinglePaymentSubmit"
              >
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
            <div
              class="details-info payment-summary-cards payment-batch-summary-cards"
            >
              <div
                v-if="canViewPaymentField('supplier_name')"
                class="info-row batch-summary-supplier"
              >
                <label><i class="fas fa-truck-loading" />供应商</label>
                <span>{{ paymentDetails.supplier_name }}</span>
              </div>
              <div
                v-if="canViewPaymentField('payment_time')"
                class="info-row batch-summary-time"
              >
                <label><i class="fas fa-clock" />打款时间</label>
                <el-tooltip
                  :content="`完整时间：${formatDateTimeBeijing(paymentDetails.payment_time)}`"
                  placement="top"
                  :disabled="!paymentDetails.payment_time"
                >
                  <span class="payment-summary-time">
                    {{ formatDateBeijing(paymentDetails.payment_time) }}
                  </span>
                </el-tooltip>
              </div>
              <div
                v-if="canViewPaymentField('remarks')"
                class="info-row batch-summary-remarks"
              >
                <label><i class="fas fa-note-sticky" />备注</label>
                <span>{{ paymentDetails.payment_remarks || '-' }}</span>
              </div>
              <div
                v-if="canViewPaymentField('payment_method')"
                class="info-row batch-summary-method"
              >
                <label><i class="fas fa-credit-card" />支付方式</label>
                <span class="highlight">{{ getPaymentMethodLabel(paymentDetails.payment_method) }}</span>
              </div>
              <div
                v-if="canViewPaymentField('payment_operator')"
                class="info-row batch-summary-operator"
              >
                <label><i class="fas fa-user-check" />打款人</label>
                <span class="highlight">{{ paymentDetails.payment_operator || '-' }}</span>
              </div>
              <div class="info-row batch-summary-count">
                <label><i class="fas fa-mobile-alt" />手机数量</label>
                <span class="highlight">{{ paymentDetails.phones?.length || 0 }} 台</span>
              </div>
              <div
                v-if="canViewPaymentField('purchase_cost')"
                class="info-row batch-summary-cost"
              >
                <label><i class="fas fa-coins" />总成本</label>
                <span class="amount">¥{{ formatAmount(paymentDetails.total_cost) }}</span>
              </div>
              <div
                v-if="canViewPaymentField('sale_price')"
                class="info-row batch-summary-sales"
              >
                <label><i class="fas fa-tags" />总销售</label>
                <span class="amount">¥{{ formatAmount(paymentDetails.total_sale) }}</span>
              </div>
              <div
                v-if="canViewPaymentField('profit') && !isPaymentImageCaptureMode"
                :class="[
                  'info-row batch-summary-profit hide-in-capture',
                  paymentDetails.total_profit >= 0 ? 'is-positive' : 'is-negative'
                ]"
              >
                <label><i class="fas fa-chart-line" />总利润</label>
                <span :class="['amount', 'profit-value', paymentDetails.total_profit >= 0 ? 'profit-positive' : 'profit-negative']">
                  ¥{{ formatAmount(paymentDetails.total_profit) }}
                </span>
              </div>
            </div>

            <!-- 手机明细表格 -->
            <div
              ref="paymentDetailsForCapture"
              class="batch-details-table"
            >
              <div class="table-responsive payment-dialog-table-container">
                <el-table
                  :data="paymentDetails.phones || []"
                  border
                  stripe
                  class="data-table devices-table payment-detail-table"
                  table-layout="fixed"
                  :fit="true"
                  row-key="id"
                  :row-class-name="getPaymentDialogRowClassName"
                  :cell-class-name="getPaymentDialogCellClassName"
                >
                  <el-table-column
                    label="序号"
                    width="60"
                    align="center"
                  >
                    <template #default="{ $index }">
                      <span class="index-badge">{{ $index + 1 }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('supplier_name')"
                    prop="supplier_name"
                    label="供应商"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'supplier_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.supplier_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('sale_time')"
                    label="销售时间"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'sale_time')"
                    align="center"
                    class-name="time-cell"
                  >
                    <template #default="{ row }">
                      {{ formatDateBeijing(row.sale_time) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('store_name')"
                    prop="store_name"
                    label="店铺"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'store_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.store_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('brand_name')"
                    prop="brand_name"
                    label="品牌"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'brand_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.brand_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('model_name')"
                    prop="model_name"
                    label="型号"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'model_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.model_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('color_name')"
                    prop="color_name"
                    label="颜色"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'color_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.color_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('memory_name')"
                    prop="memory_name"
                    label="内存"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'memory_name')"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.memory_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('serial_number')"
                    label="序列号"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'serial_number')"
                    align="center"
                    class-name="identifier-column serial-imei-column"
                  >
                    <template #default="{ row }">
                      <span class="serial-number">{{ row.serial_number || '-' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('imei')"
                    label="IMEI"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'imei')"
                    align="center"
                    class-name="identifier-column serial-imei-column"
                  >
                    <template #default="{ row }">
                      <span :class="['imei', row.phone_status === 'peer_transfer' ? 'admin-wholesale-text' : '']">{{ row.imei || '-' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('purchase_cost')"
                    label="入库价格"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'purchase_cost')"
                    align="center"
                  >
                    <template #default="{ row }">
                      <span class="price">¥{{ formatAmount(row.purchase_cost) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('profit') && !isPaymentImageCaptureMode"
                    label="利润"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'profit')"
                    align="center"
                    class-name="hide-in-capture"
                  >
                    <template #default="{ row }">
                      <span :class="['price-cell', getPhoneProfit(row) >= 0 ? 'profit-positive' : 'profit-negative', 'hide-in-capture']">
                        ¥{{ formatAmount(getPhoneProfit(row)) }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewPaymentField('payment_time')"
                    label="打款时间"
                    :min-width="getPaymentDialogColumnWidth(paymentDetails.phones || [], 'payment_time')"
                    align="center"
                    class-name="time-cell"
                  >
                    <template #default="{ row }">
                      <el-tooltip
                        :content="`完整时间：${formatDateTimeBeijing(row.payment_time)}`"
                        placement="top"
                        :disabled="!row.payment_time"
                      >
                        <span class="payment-time-badge">{{ formatDateBeijing(row.payment_time) }}</span>
                      </el-tooltip>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="payment-dialog-footer">
              <el-button
                v-if="canDeletePayment && paymentDetails.phones?.length > 0"
                type="danger"
                :loading="removingPayment"
                @click="handleBatchCancelPayment"
              >
                <i class="fas fa-times-circle" />
                <span>全部取消</span>
              </el-button>
              <el-button
                type="primary"
                :loading="savingImage"
                @click="savePaymentDetailsAsImage"
              >
                <span v-if="savingImage">保存中...</span>
                <template v-else>
                  <i class="fas fa-camera" />
                  <span>保存图片</span>
                </template>
              </el-button>
              <el-button
                type="default"
                @click="showPaymentDetailsDialog = false"
              >
                关闭
              </el-button>
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
              <div
                v-if="canViewPaymentField('imei')"
                class="info-row summary-item summary-item-imei"
              >
                <label>IMEI:</label>
                <span class="imei-number">{{ editingPhone?.imei || '-' }}</span>
              </div>
              <div
                v-if="canViewPaymentField('model_name')"
                class="info-row summary-item summary-item-model"
              >
                <label>型号:</label>
                <span>{{ editingPhone?.full_model_name || editingPhone?.model_name || '-' }}</span>
              </div>
              <div
                v-if="canViewPaymentField('purchase_cost')"
                class="info-row summary-item summary-item-cost"
              >
                <label>进价:</label>
                <span class="amount">¥{{ formatAmount(editingPhone?.purchase_cost) }}</span>
              </div>
            </div>

            <el-form
              :model="editPaymentForm"
              label-width="100px"
            >
              <el-form-item
                v-if="canViewPaymentField('payment_method')"
                label="打款方式"
                prop="payment_method"
              >
                <PaymentMethodSelect
                  v-model="editPaymentForm.payment_method"
                  variant="settlement"
                  placeholder="请选择打款方式"
                  :disabled="!canEditPaymentField('payment_method')"
                />
              </el-form-item>

              <el-form-item
                v-if="canViewPaymentField('payment_time')"
                label="打款时间"
                prop="payment_time"
              >
                <el-date-picker
                  v-model="editPaymentForm.payment_time"
                  type="date"
                  placeholder="选择打款时间"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  class="form-control el-date-form-control"
                  :clearable="true"
                  :disabled="!canEditPaymentField('payment_time')"
                />
              </el-form-item>
              <el-form-item
                v-if="canViewPaymentField('remarks')"
                label="备注"
                prop="payment_remarks"
              >
                <el-input
                  v-model="editPaymentForm.payment_remarks"
                  type="textarea"
                  :rows="3"
                  maxlength="1000"
                  placeholder="填写打款备注（可选）"
                  :disabled="!canEditPaymentField('remarks')"
                />
              </el-form-item>
            </el-form>
          </div>

          <template #footer>
            <div class="payment-dialog-footer">
              <el-button
                type="default"
                @click="showEditPaymentDialog = false"
              >
                取消
              </el-button>
              <el-button
                type="primary"
                :loading="submitting"
                @click="handleEditPaymentSubmit"
              >
                保存修改
              </el-button>
            </div>
          </template>
        </MobileDialog>
      </div>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import unifiedApi from '@/utils/unified-api'
import logger from '@/utils/logger'
import { getPhoneStatusLabel } from '@/constants/phoneStatuses'
import { getPaymentMethodLabel } from '@/constants/paymentMethods'
import { useNotification } from '@/composables/useNotification'
import { useImportExport } from '@/composables/useImportExport'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useMobile } from '@/composables/mobile'
import { useLoadingState } from '@/composables'
import { useAuthStore } from '@/stores/auth'
import Pagination from '@/components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import { PaymentMethodSelect } from '@/components/payment'
import InlineLoading from '@/components/InlineLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { PageHeader, PermissionGate } from '@/components/base'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { loadHtml2Canvas } from '@/utils/html2canvas'
import { sortOptionsByOrder } from '@/utils/option-sort'
import { getAdaptiveActionColumnWidth, getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { formatAmount } from '@/utils/format'

const _router = useRouter()
const { success, error, warning, info } = useNotification()
const refreshing = ref(false)
const authStore = useAuthStore()
const { isMobile } = useMobile()
const { exportFile, buildDateFilename } = useImportExport()
const { init: initFieldPermissions } = fieldPermissions

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
  remarks: 'payment.remarks',
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
  supplier_count: number
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
  inventory_time?: string | null
  sale_time?: string | null
  payment_status?: 'paid' | 'unpaid' | string
  payment_method?: string | null
  payment_remarks?: string
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
  payment_remarks: string
  phones: SupplierPaymentPhone[]
  total_cost: number
  total_sale: number
  total_profit: number
}

interface SupplierPaymentListParams {
  sale_status: string
  payment_status: string
  page?: number
  page_size?: number
  supplier_id?: string
  store_id?: string
  keyword?: string
  start_date?: string
  end_date?: string
}

interface SupplierPaymentPagination {
  total?: number
  page?: number
  page_size?: number
  total_pages?: number
  has_next?: boolean
  has_prev?: boolean
}

interface SupplierPaymentApiResponse<T> {
  success: boolean
  data: T
  message?: string
  pagination?: SupplierPaymentPagination
}

type PaymentDialogColumnField =
  | 'supplier_name'
  | 'sale_time'
  | 'store_name'
  | 'brand_name'
  | 'model_name'
  | 'color_name'
  | 'memory_name'
  | 'serial_number'
  | 'imei'
  | 'purchase_cost'
  | 'profit'
  | 'payment_time'

const paymentDialogColumnConfig: Record<PaymentDialogColumnField, { label: string; minWidth: number }> = {
  supplier_name: { label: '供应商', minWidth: 80 },
  sale_time: { label: '销售时间', minWidth: 104 },
  store_name: { label: '店铺', minWidth: 64 },
  brand_name: { label: '品牌', minWidth: 64 },
  model_name: { label: '型号', minWidth: 96 },
  color_name: { label: '颜色', minWidth: 56 },
  memory_name: { label: '内存', minWidth: 64 },
  serial_number: { label: '序列号', minWidth: 104 },
  imei: { label: 'IMEI', minWidth: 136 },
  purchase_cost: { label: '入库价格', minWidth: 84 },
  profit: { label: '利润', minWidth: 72 },
  payment_time: { label: '打款时间', minWidth: 120 }
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
const showPaymentActionField = computed(() => shouldShowActionColumn(
  canViewPaymentField('actions'),
  [canEditPayment.value, canDeletePayment.value]
))
const showPaymentStatusField = computed(() => {
  const visible = shouldShowActionColumn(
    canViewPaymentField('payment_status'),
    [canCreatePayment.value]
  )
  return visible && (!isMobile.value || paymentMobileCoreFields.has('payment_status'))
})
const showPaymentTimeColumn = computed(() => {
  const visible = canViewPaymentField('payment_time') || canCreatePayment.value
  return visible && (!isMobile.value || paymentMobileCoreFields.has('payment_time'))
})
const paymentMobileCoreFields = new Set([
  'supplier_name',
  'model_name',
  'color_name',
  'memory_name',
  'serial_number',
  'payment_status',
  'payment_time'
])
const shouldShowPaymentColumn = (fieldName: string) => {
  if (!canViewPaymentField(fieldName)) return false
  if (!isMobile.value) return true
  return paymentMobileCoreFields.has(fieldName)
}
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
  { bg: '#fce7f3', text: '#be185d' }   // 洋红
]

// 根据打款时间生成颜色索引（精确到分钟，每个不同的打款时间都是不同批次）
const getPaymentTimeColorIndex = (paymentTime: string): number => {
  if (!paymentTime) return 0

  const date = new Date(paymentTime)
  // 使用年月日时分钟作为种子，精确到分钟
  // 使用质数乘数来增加随机性，避免相邻时间使用相近颜色
  const seed = (date.getFullYear() * 997 +
               (date.getMonth() + 1) * 101 +
               date.getDate() * 73 +
               date.getHours() * 37 +
               date.getMinutes() * 17) % 1000000007 // 使用大质数取模

  return Math.abs(seed) % paymentTimeColors.length
}

// 获取当前北京时间（UTC+8）格式：YYYY-MM-DD HH:mm:ss
const getCurrentBeijingTime = (): string => {
  return TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
}

const getCurrentBeijingDate = (): string => getCurrentBeijingTime().slice(0, 10)

const normalizePaymentDateTime = (value: string): string => {
  if (!value) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value} ${getCurrentBeijingTime().slice(11)}`
  }
  return value
}

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = Number.parseFloat(String(value ?? 0))
  return Number.isNaN(parsed) ? 0 : parsed
}

const getPhoneProfit = (phone?: SupplierPaymentPhone | null): number => {
  return toNumber(phone?.sale_price) - toNumber(phone?.purchase_cost)
}

const isSupplierPaymentError = (err: unknown): err is SupplierPaymentError => {
  return typeof err === 'object' && err !== null
}

const isRequestCanceled = (err: unknown): boolean => {
  if (!isSupplierPaymentError(err)) {
    return false
  }

  return err.code === 'ERR_CANCELED'
    || err.name === 'CanceledError'
    || err.message?.includes('canceled') === true
}

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (!isSupplierPaymentError(err)) {
    return fallback
  }

  const responseError = err.response?.data?.error
  if (typeof responseError === 'string' && responseError.trim()) {
    return responseError
  }

  if (typeof responseError === 'object' && responseError?.message?.trim()) {
    return responseError.message
  }

  if (err.response?.data?.message?.trim()) {
    return err.response.data.message
  }

  if (err.message?.trim()) {
    return err.message
  }

  return fallback
}

const { loading } = useLoadingState()
const { loading: submitting } = useLoadingState()
const removingPayment = ref(false)
const savingImage = ref(false)

// 图片截图引用
const paymentDetailsForCapture = ref<HTMLElement | null>(null)
const batchPaymentTableForCapture = ref<HTMLElement | null>(null)
const singlePaymentForCapture = ref<HTMLElement | null>(null)
const isPaymentImageCaptureMode = ref(false)

const waitForCaptureLayout = async () => {
  await nextTick()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

const getCaptureContentWidth = (element: HTMLElement) => {
  const tableElements = Array.from(element.querySelectorAll<HTMLElement>(
    '.el-table__header-wrapper table, .el-table__body-wrapper table'
  ))
  const tableWidth = tableElements.reduce((maxWidth, table) => {
    return Math.max(maxWidth, table.scrollWidth, table.getBoundingClientRect().width)
  }, 0)

  if (tableWidth > 0) {
    return Math.ceil(tableWidth)
  }

  return Math.ceil(Math.max(element.scrollWidth, element.getBoundingClientRect().width))
}

const withCaptureLayout = async (
  element: HTMLElement,
  action: () => Promise<void>
) => {
  const previousCaptureMode = isPaymentImageCaptureMode.value
  isPaymentImageCaptureMode.value = true
  await waitForCaptureLayout()

  const hideElements = Array.from(element.querySelectorAll('.hide-in-capture')) as HTMLElement[]
  const responsiveContainers = [
    element,
    ...Array.from(element.querySelectorAll('.table-responsive')) as HTMLElement[]
  ]
  const styleSnapshots = responsiveContainers.map((node) => ({
    node,
    overflowX: node.style.overflowX,
    overflowY: node.style.overflowY,
    maxWidth: node.style.maxWidth,
    width: node.style.width
  }))

  try {
    hideElements.forEach((node) => {
      node.style.display = 'none'
    })

    const captureWidth = getCaptureContentWidth(element)

    styleSnapshots.forEach(({ node }) => {
      node.style.overflowX = 'visible'
      node.style.overflowY = 'visible'
      node.style.maxWidth = 'none'
      if (captureWidth > 0) {
        node.style.width = `${captureWidth}px`
      }
    })

    window.dispatchEvent(new Event('resize'))
    await waitForCaptureLayout()
    await action()
  } finally {
    styleSnapshots.forEach(({ node, overflowX, overflowY, maxWidth, width }) => {
      node.style.overflowX = overflowX
      node.style.overflowY = overflowY
      node.style.maxWidth = maxWidth
      node.style.width = width
    })

    hideElements.forEach((node) => {
      node.style.display = ''
    })

    isPaymentImageCaptureMode.value = previousCaptureMode
    window.dispatchEvent(new Event('resize'))
    await waitForCaptureLayout()
  }
}

const downloadCaptureImage = async (
  element: HTMLElement,
  fileName: string
) => {
  const captureWidth = getCaptureContentWidth(element)
  const captureHeight = Math.ceil(Math.max(element.scrollHeight, element.getBoundingClientRect().height))
  const html2canvas = await loadHtml2Canvas()

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
  })

  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('生成图片失败'))
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = fileName
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
      resolve()
    }, 'image/png')
  })
}

// 移动端搜索展开状态
const searchExpanded = ref(false)
const stores = ref<StoreOption[]>([])
const statistics = ref<SupplierPaymentStatistic[]>([])
const summaryStatistics = ref<SupplierPaymentSummary>({
  total_unpaid_count: 0,
  total_unpaid_amount: 0,
  total_paid_count: 0,
  total_paid_amount: 0,
  supplier_count: 0
})
const phones = ref<SupplierPaymentPhone[]>([])
const paymentActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(
  phones.value,
  [
    { label: '查看', visible: phone => canViewPayments.value && phone.payment_status !== 'unpaid' },
    { label: '编辑', visible: phone => canEditPayment.value && phone.payment_status !== 'unpaid' },
    { label: '取消打款', visible: phone => canDeletePayment.value && phone.payment_status !== 'unpaid' }
  ]
))
const getPaymentTextColumnWidth = (
  label: string,
  values: Array<string | number | null | undefined>,
  minWidth: number
) => getTextColumnMinWidth(
  [label, ...values],
  {
    minWidth,
    horizontalPadding: 24,
    asciiCharacterWidth: 8,
    wideCharacterWidth: 13
  }
)
const paymentSupplierColumnWidth = computed(() => getPaymentTextColumnWidth(
  '供应商',
  phones.value.map((phone) => phone.supplier_name),
  isMobile.value ? 96 : 96
))
const paymentStoreColumnWidth = computed(() => getPaymentTextColumnWidth(
  '店铺',
  phones.value.map((phone) => phone.store_name),
  isMobile.value ? 76 : 76
))
const paymentBrandColumnWidth = computed(() => getPaymentTextColumnWidth(
  '品牌',
  phones.value.map((phone) => phone.brand_name),
  isMobile.value ? 72 : 72
))
const paymentModelColumnWidth = computed(() => getPaymentTextColumnWidth(
  '型号',
  phones.value.map((phone) => phone.model_name),
  isMobile.value ? 96 : 96
))
const paymentColorColumnWidth = computed(() => getPaymentTextColumnWidth(
  '颜色',
  phones.value.map((phone) => phone.color_name),
  isMobile.value ? 72 : 72
))
const paymentMemoryColumnWidth = computed(() => getPaymentTextColumnWidth(
  '内存',
  phones.value.map((phone) => phone.memory_name),
  isMobile.value ? 72 : 72
))
const paymentSerialColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['序列号', ...phones.value.map((phone) => phone.serial_number)],
  { minWidth: isMobile.value ? 150 : 156, horizontalPadding: 28 }
))
const paymentImeiColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['IMEI', ...phones.value.map((phone) => phone.imei)],
  { minWidth: isMobile.value ? 150 : 156, horizontalPadding: 28 }
))
const paymentPurchaseCostColumnWidth = computed(() => getPaymentTextColumnWidth(
  '入库价格',
  phones.value.map(phone => `¥${formatAmount(phone.purchase_cost)}`),
  88
))
const paymentSalePriceColumnWidth = computed(() => getPaymentTextColumnWidth(
  '销售价格',
  phones.value.map(phone => `¥${formatAmount(phone.sale_price)}`),
  88
))
const paymentProfitColumnWidth = computed(() => getPaymentTextColumnWidth(
  '利润',
  phones.value.map(phone => `¥${formatAmount(getPhoneProfit(phone))}`),
  78
))
const paymentPurchaseDateColumnWidth = computed(() => getPaymentTextColumnWidth(
  '入库时间',
  phones.value.map(phone => formatDate(phone.inventory_time)),
  104
))
const paymentSaleDateColumnWidth = computed(() => getPaymentTextColumnWidth(
  '销售时间',
  phones.value.map(phone => formatDate(phone.sale_time)),
  104
))
const paymentStatusColumnWidth = computed(() => getPaymentTextColumnWidth(
  '打款状态',
  canViewPaymentField('payment_status')
    ? phones.value.map(phone => phone.payment_status === 'paid' ? '已打款' : '未打款')
    : [],
  isMobile.value ? 74 : 84
))
const paymentTimeColumnWidth = computed(() => getTextColumnMinWidth(
  ['打款时间', ...phones.value.map(phone => phone.payment_time ? formatDateTimeBeijing(phone.payment_time) : '-')],
  {
    minWidth: isMobile.value ? 166 : 174,
    horizontalPadding: 44,
    asciiCharacterWidth: isMobile.value ? 6.5 : 8,
    wideCharacterWidth: isMobile.value ? 11 : 13
  }
))
const currentPhone = ref<SupplierPaymentPhone | null>(null)
const editingPhone = ref<SupplierPaymentPhone | null>(null)
const paymentDetails = ref<PaymentDetailsState>({
  supplier_name: '',
  payment_time: null,
  payment_method: '',
  payment_operator: '',
  payment_remarks: '',
  phones: [],
  total_cost: 0,
  total_sale: 0,
  total_profit: 0
})

const selectedPhones = ref<number[]>([])
// 存储已选择手机的完整对象，确保在任何筛选条件下都能获取完整数据
const selectedPhoneMap = ref<Map<number, SupplierPaymentPhone>>(new Map())
const currentPageSelectableIds = computed(() => phones.value
  .filter((phone) => phone.payment_status === 'unpaid')
  .map((phone) => phone.id))
const isCurrentPageAllSelected = computed(() => {
  return currentPageSelectableIds.value.length > 0
    && currentPageSelectableIds.value.every((id) => selectedPhones.value.includes(id))
})
const isCurrentPagePartiallySelected = computed(() => {
  const selectedCount = currentPageSelectableIds.value.filter((id) => selectedPhones.value.includes(id)).length
  return selectedCount > 0 && selectedCount < currentPageSelectableIds.value.length
})
const exportingPaymentPhones = ref(false)
const mobileActionRowId = ref<number | null>(null)
const lastTappedRowId = ref<number | null>(null)
const lastTapTimestamp = ref(0)

const filters = reactive({
  keyword: '',
  supplier_id: '',
  store_id: '',
  sale_status: 'all',
  payment_status: 'all',  // 默认显示全部（已打款和未打款）
  start_date: '',  // 开始时间
  end_date: ''     // 结束时间
})

const hasPaymentFilterValue = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== ''

const syncVisiblePaymentFilters = () => {
  if (!showPaymentSearchKeyword.value) {
    filters.keyword = ''
  }
  if (!canViewPaymentField('supplier_name')) {
    filters.supplier_id = ''
  }
  if (!canViewPaymentField('store_name')) {
    filters.store_id = ''
  }
  if (!canViewPaymentField('sale_status')) {
    filters.sale_status = 'all'
  }
  if (!canViewPaymentField('payment_status')) {
    filters.payment_status = 'all'
  }
  if (!canViewPaymentField('sale_time')) {
    filters.start_date = ''
    filters.end_date = ''
  }
}

const buildPaymentListParams = (includePagination = true) => {
  const params: SupplierPaymentListParams = {
    sale_status: canViewPaymentField('sale_status') ? filters.sale_status : 'all',
    payment_status: canViewPaymentField('payment_status') ? filters.payment_status : 'all'
  }

  if (includePagination) {
    params.page = pagination.page
    params.page_size = pagination.page_size
  }

  if (canViewPaymentField('supplier_name') && hasPaymentFilterValue(filters.supplier_id)) {
    params.supplier_id = filters.supplier_id
  }

  if (canViewPaymentField('store_name') && hasPaymentFilterValue(filters.store_id)) {
    params.store_id = filters.store_id
  }

  if (showPaymentSearchKeyword.value && hasPaymentFilterValue(filters.keyword)) {
    params.keyword = filters.keyword.trim()
  }

  if (canViewPaymentField('sale_time') && hasPaymentFilterValue(filters.start_date)) {
    params.start_date = filters.start_date.trim()
  }

  if (canViewPaymentField('sale_time') && hasPaymentFilterValue(filters.end_date)) {
    params.end_date = filters.end_date.trim()
  }

  return params
}

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
  })
}

const pagination = reactive({
  page: 1,
  page_size: 50,
  total: 0,
  total_pages: 0,
  has_next: false,
  has_prev: false
})

const showBatchPaymentDialog = ref(false)
const showSinglePaymentDialog = ref(false)
const showPaymentDetailsDialog = ref(false)
const showEditPaymentDialog = ref(false)

// 获取当前用户显示名称（工号对应的姓名）
const getCurrentUserDisplayName = () => {
  const user = authStore.user
  if (!user) return ''
  // 优先使用name（工号对应的姓名），如果没有则使用username（工号）
  return user.name || user.username || ''
}

const paymentForm = reactive({
  payment_method: 'bank_transfer',
  payment_time: getCurrentBeijingDate(),
  payment_operator: getCurrentUserDisplayName(),
  payment_remarks: ''
})

const editPaymentForm = reactive({
  payment_method: 'bank_transfer',
  payment_time: '',
  payment_remarks: ''
})

// 计算卡片统计数据：根据当前筛选条件动态计算
const currentSupplierCount = computed(() => {
  return Number(summaryStatistics.value.supplier_count || 0)
})

const currentSupplierMeta = computed(() => {
  if (filters.supplier_id) {
    const supplier = statistics.value.find((item) => item.supplier_id === Number.parseInt(filters.supplier_id, 10))
    if (supplier?.supplier_name) return supplier.supplier_name
  }

  if (filters.payment_status === 'paid') {
    return '已打款供应商'
  }

  if (filters.payment_status === 'unpaid') {
    return '待打款供应商'
  }

  return '全部供应商'
})

// 当前筛选条件下的统计数据 - 使用实际加载数据
const currentTotalCount = computed(() => {
  return Number(summaryStatistics.value.total_unpaid_count || 0)
    + Number(summaryStatistics.value.total_paid_count || 0)
})

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

const getPaymentRowClassName = ({ row }: { row: SupplierPaymentPhone }) => {
  return [
    row.phone_status === 'peer_transfer' ? 'admin-row--peer-transfer' : '',
    selectedPhones.value.includes(row.id) ? 'row-selected' : '',
    isMobile.value && mobileActionRowId.value === row.id ? 'mobile-action-expanded' : ''
  ].filter(Boolean).join(' ')
}

const getPaymentDialogRowClassName = ({ row }: { row: SupplierPaymentPhone }) => {
  return row.phone_status === 'peer_transfer' ? 'admin-row--peer-transfer' : ''
}

const getPaymentDialogCellClassName = () => 'complete-text-column'

const currentTotalAmount = computed(() => {
  return Number(summaryStatistics.value.total_unpaid_amount || 0)
    + Number(summaryStatistics.value.total_paid_amount || 0)
})

// 基于实际加载数据计算当前筛选条件下的统计
const currentUnpaidCount = computed(() => {
  return Number(summaryStatistics.value.total_unpaid_count || 0)
})

const currentUnpaidAmount = computed(() => {
  return Number(summaryStatistics.value.total_unpaid_amount || 0)
})

const currentPaidCount = computed(() => {
  return Number(summaryStatistics.value.total_paid_count || 0)
})

const currentPaidAmount = computed(() => {
  return Number(summaryStatistics.value.total_paid_amount || 0)
})

// 保留旧的计算属性以兼容现有代码
const _totalUnpaidCount = currentUnpaidCount
const _totalUnpaidAmount = currentUnpaidAmount
const _totalPaidCount = currentPaidCount
const _totalPaidAmount = currentPaidAmount

// 获取选中的完整手机对象 - 优先从 selectedPhoneMap 获取，确保已选择数据在任何筛选条件下都可见
const selectedPhoneObjects = computed(() => {
  const result: SupplierPaymentPhone[] = []
  selectedPhones.value.forEach((phoneId: number) => {
    // 优先从 map 中获取已存储的完整数据
    if (selectedPhoneMap.value.has(phoneId)) {
      const selectedPhone = selectedPhoneMap.value.get(phoneId)
      if (selectedPhone) {
        result.push(selectedPhone)
      }
    } else {
      // 如果 map 中没有，尝试从当前页数据中获取
      const phone = phones.value.find((item) => item.id === phoneId)
      if (phone) {
        result.push(phone)
        // 同步到 map 中
        selectedPhoneMap.value.set(phoneId, phone)
      }
    }
  })
  return result
})

const selectedTotalAmount = computed(() => {
  return selectedPhoneObjects.value.reduce((sum: number, phone) => {
    return sum + toNumber(phone?.purchase_cost)
  }, 0)
})

const selectedTotalProfit = computed(() => {
  return selectedPhoneObjects.value.reduce((sum: number, phone) => {
    return sum + (toNumber(phone?.sale_price) - toNumber(phone?.purchase_cost))
  }, 0)
})

const loadStatistics = async (showLoadingState = true) => {
  try {
    if (showLoadingState) {
      loading.value = true
    }
    // 总是获取所有供应商的统计数据（不传 supplier_id），用于下拉框和卡片数据
    const response = await unifiedApi.get('/supplier-payments/statistics', {
      params: {
        sale_status: canViewPaymentField('sale_status') ? filters.sale_status : 'all'
      }
    }) as SupplierPaymentApiResponse<SupplierPaymentStatistic[]>

    if (response.success) {
      statistics.value = Array.isArray(response.data) ? response.data : []
    }
  } catch (err: unknown) {
    // 忽略被取消的请求
    if (isRequestCanceled(err)) {
      return
    }
    logger.error('加载统计数据失败:', err)
    error('加载统计数据失败')
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

const loadSummaryStatistics = async () => {
  try {
    const response = await unifiedApi.get('/supplier-payments/summary-statistics', {
      params: buildPaymentListParams(false)
    }) as SupplierPaymentApiResponse<Partial<SupplierPaymentSummary>>

    if (response.success) {
      summaryStatistics.value = {
        total_unpaid_count: Number(response.data?.total_unpaid_count || 0),
        total_unpaid_amount: response.data?.total_unpaid_amount || 0,
        total_paid_count: Number(response.data?.total_paid_count || 0),
        total_paid_amount: response.data?.total_paid_amount || 0,
        supplier_count: Number(response.data?.supplier_count || 0)
      }
    }
  } catch (err: unknown) {
    // 忽略被取消的请求
    if (isRequestCanceled(err)) {
      return
    }
    logger.error('加载汇总统计失败:', err)
    error('加载汇总统计失败')
  }
}

const loadStores = async () => {
  try {
    // 传递 all=true 参数获取所有店铺（用于下拉选择）
    const response = await unifiedApi.get('/stores?all=true') as SupplierPaymentApiResponse<StoreOption[]>
    if (response.success) {
      stores.value = sortOptionsByOrder(Array.isArray(response.data) ? response.data : [])
    }
  } catch (err) {
    logger.error('加载店铺列表失败:', err)
  }
}

const loadPhones = async (showLoadingState = true) => {
  try {
    if (showLoadingState) {
      loading.value = true
    }
    const response = await unifiedApi.get('/supplier-payments/phones', {
      params: buildPaymentListParams()
    }) as SupplierPaymentApiResponse<SupplierPaymentPhone[]>

    if (response.success) {
      const phoneList = Array.isArray(response.data) ? response.data : []
      // 对返回的数据进行排序：已选中的数据排在前面，然后按销售时间降序（最近的靠前）
      const sortedData = [...phoneList].sort((a, b) => {
        const aSelected = selectedPhones.value.includes(a.id)
        const bSelected = selectedPhones.value.includes(b.id)

        // 如果两个都是选中或都是未选中，按销售时间降序排列
        if (aSelected === bSelected) {
          // 销售时间最近的靠前（降序）
          const timeA = new Date(a.sale_time || 0).getTime()
          const timeB = new Date(b.sale_time || 0).getTime()
          return timeB - timeA // 降序，最新的在前
        }

        // 选中的排在前面
        return aSelected ? -1 : 1
      })

      phones.value = sortedData
      // pagination 是响应中的单独字段，不在 data 里
      pagination.page = Number(response.pagination?.page) || pagination.page
      pagination.page_size = Number(response.pagination?.page_size) || pagination.page_size
      pagination.total = Number(response.pagination?.total) || 0
      pagination.total_pages = Number(response.pagination?.total_pages) || 0
      pagination.has_next = Boolean(response.pagination?.has_next)
      pagination.has_prev = Boolean(response.pagination?.has_prev)
      // 移除清空已选择数据的逻辑，保持已选择状态
      // selectedPhones.value 和 selectedPhoneMap 不在此清空
      // 更新 selectedPhoneMap 中的数据（仅更新已存在的）
      phoneList.forEach((phone) => {
        if (selectedPhoneMap.value.has(phone.id)) {
          selectedPhoneMap.value.set(phone.id, phone)
        }
      })
    }
  } catch (err: unknown) {
    // 忽略被取消的请求
    if (isRequestCanceled(err)) {
      return
    }
    logger.error('加载手机列表失败:', err)
    error('加载手机列表失败')
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

// 监听 selectedPhones 变化，同步更新 selectedPhoneMap
watch(selectedPhones, (newIds, oldIds) => {
  // 找出新增的 ID
  const addedIds = newIds.filter((id: number) => !oldIds.includes(id))
  // 找出移除的 ID
  const removedIds = oldIds.filter((id: number) => !newIds.includes(id))

  // 从当前页数据中找到新增的手机对象并添加到 map
  addedIds.forEach((id: number) => {
    const phone = phones.value.find((item) => item.id === id)
    if (phone) {
      selectedPhoneMap.value.set(id, phone)
    }
  })

  // 从 map 中移除被取消选择的数据
  removedIds.forEach((id: number) => {
    selectedPhoneMap.value.delete(id)
  })
}, { deep: true })

const handleFilterChange = () => {
  syncVisiblePaymentFilters()

  // 确保筛选值是有效的字符串
  if (filters.supplier_id === null || filters.supplier_id === undefined) {
    filters.supplier_id = ''
  }
  if (filters.store_id === null || filters.store_id === undefined) {
    filters.store_id = ''
  }
  if (filters.sale_status === null || filters.sale_status === undefined) {
    filters.sale_status = 'all'
  }
  if (filters.payment_status === null || filters.payment_status === undefined) {
    filters.payment_status = 'all'
  }

  pagination.page = 1
  // 注意：不清空已选择的数据，允许跨筛选条件批量选择
  loadSummaryStatistics()
  loadStatistics()
  loadPhones()
}

const clearKeyword = () => {
  if (!showPaymentSearchKeyword.value) {
    return
  }
  filters.keyword = ''
  handleFilterChange()
}

// 清空所有选择
const clearSelection = () => {
  selectedPhones.value = []
  selectedPhoneMap.value = new Map()
  info('已清空所有选择')
}

const handleSelectAll = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked

  if (checked) {
    const unpaidPhones = phones.value.filter((phone) => phone.payment_status === 'unpaid')
    // 增量选择：合并已选择的数据，而不是替换
    const newPhoneIds = unpaidPhones.map((phone) => phone.id)
    const previousIds = new Set(selectedPhones.value)
    const combinedIds = [...new Set([...selectedPhones.value, ...newPhoneIds])]
    selectedPhones.value = combinedIds
    // 更新 map
    unpaidPhones.forEach((phone) => {
      selectedPhoneMap.value.set(phone.id, phone)
    })

    // 如果当前页有已打款的手机，提示用户
    const paidCount = phones.value.length - unpaidPhones.length
    const newlySelected = newPhoneIds.filter((id: number) => !previousIds.has(id))
    if (paidCount > 0) {
      info(`当前页有 ${paidCount} 台手机已打款，已自动跳过。共选择 ${selectedPhones.value.length} 台未打款手机。`)
    } else if (newlySelected.length > 0) {
      info(`已选择 ${selectedPhones.value.length} 台手机（新增 ${newlySelected.length} 台）。`)
    }
  } else {
    // 取消全选时，只取消当前页的选择
    const currentPageIds = currentPageSelectableIds.value
    selectedPhones.value = selectedPhones.value.filter((id: number) => !currentPageIds.includes(id))
    // 从 map 中移除当前页的数据
    currentPageIds.forEach((id: number) => {
      selectedPhoneMap.value.delete(id)
    })
  }
}

const handlePhoneSelectionChange = (phone: SupplierPaymentPhone, event: Event) => {
  const checked = (event.target as HTMLInputElement).checked

  if (checked) {
    if (!selectedPhones.value.includes(phone.id)) {
      selectedPhones.value = [...selectedPhones.value, phone.id]
    }
    selectedPhoneMap.value.set(phone.id, phone)
    return
  }

  selectedPhones.value = selectedPhones.value.filter((id) => id !== phone.id)
  selectedPhoneMap.value.delete(phone.id)
}

// 打开批量打款对话框时更新时间为当前时间
const handleOpenBatchPaymentDialog = () => {
  if (!canCreatePayment.value) {
    handleNoPermission('create')
    return
  }

  paymentForm.payment_method = 'bank_transfer'
  paymentForm.payment_time = getCurrentBeijingDate()
  paymentForm.payment_remarks = ''
  showBatchPaymentDialog.value = true
}

const handleSinglePayment = (phone: SupplierPaymentPhone) => {
  if (!canCreatePayment.value) {
    handleNoPermission('create')
    return
  }

  currentPhone.value = phone
  paymentForm.payment_method = 'bank_transfer'
  paymentForm.payment_time = getCurrentBeijingDate()
  paymentForm.payment_remarks = ''
  showSinglePaymentDialog.value = true
}

const handleSinglePaymentSubmit = async () => {
  if (submitting.value) return
  if (!canCreatePayment.value) {
    handleNoPermission('create')
    return
  }

  try {
    // 验证必填字段
    if (canViewPaymentField('payment_method') && !paymentForm.payment_method) {
      warning('请选择打款方式')
      return
    }
    if (canViewPaymentField('payment_time') && !paymentForm.payment_time) {
      warning('请选择打款时间')
      return
    }

    submitting.value = true

    const response = await unifiedApi.post(`/supplier-payments/${currentPhone.value.id}/payment`, {
      ...paymentForm,
      payment_time: normalizePaymentDateTime(paymentForm.payment_time),
      payment_remarks: paymentForm.payment_remarks
    }) as SupplierPaymentApiResponse<unknown>

    if (response.success) {
      success('打款成功')
      showSinglePaymentDialog.value = false
      // 清空选择状态
      clearSelection()
      refreshData({ showSuccess: false })
    }
  } catch (err: unknown) {
    logger.error('打款失败:', err)
    error(getErrorMessage(err, '打款失败'))
  } finally {
    submitting.value = false
  }
}

// 编辑打款
const handleEditPayment = (phone: SupplierPaymentPhone) => {
  if (!canEditPayment.value) {
    handleNoPermission('edit')
    return
  }

  editingPhone.value = phone
  editPaymentForm.payment_method = phone.payment_method || 'bank_transfer'
  // 如果有打款时间则转换为正确格式，否则使用当前北京时间
  if (phone.payment_time) {
    const date = new Date(phone.payment_time)
    editPaymentForm.payment_time = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  } else {
    editPaymentForm.payment_time = getCurrentBeijingDate()
  }
  editPaymentForm.payment_remarks = phone.payment_remarks || ''
  showEditPaymentDialog.value = true
}

const handleEditPaymentSubmit = async () => {
  if (submitting.value) return
  if (!canEditPayment.value) {
    handleNoPermission('edit')
    return
  }

  try {
    submitting.value = true

    const response = await unifiedApi.put(`/supplier-payments/${editingPhone.value.id}`, {
      ...editPaymentForm,
      payment_time: normalizePaymentDateTime(editPaymentForm.payment_time),
      payment_remarks: editPaymentForm.payment_remarks
    }) as SupplierPaymentApiResponse<unknown>

    if (response.success) {
      success('修改成功')
      showEditPaymentDialog.value = false
      refreshData({ showSuccess: false })
    }
  } catch (err) {
    logger.error('修改失败:', err)
    error('修改失败')
  } finally {
    submitting.value = false
  }
}

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
    )

    removingPayment.value = true

    const response = await unifiedApi.put(`/supplier-payments/${phone.id}`, {
      payment_method: null,
      payment_time: null
    })

    if (response.success) {
      success('已取消打款')
      refreshData({ showSuccess: false })
    }
  } catch (err: unknown) {
    if (err !== 'cancel') {
      logger.error('取消打款失败:', err)
      error('取消打款失败')
    }
  } finally {
    removingPayment.value = false
  }
}

// 批量取消打款（批次详情中的批量操作）
const handleBatchCancelPayment = async () => {
  if (removingPayment.value) return
  if (!canDeletePayment.value) {
    handleNoPermission('delete')
    return
  }

  try {
    const phoneIds = paymentDetails.value.phones.map((phone) => phone.id)
    if (phoneIds.length === 0) {
      warning('没有可取消打款的手机')
      return
    }

    await ElMessageBox.confirm(
      `确定要取消该批次所有手机的打款记录吗？\n\n共 ${phoneIds.length} 台手机\n此操作将清除所有手机的打款时间和打款方式，恢复到未打款状态。`,
      '批量取消打款确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    removingPayment.value = true

    const response = await unifiedApi.post('/supplier-payments/batch-cancel', {
      phone_ids: phoneIds
    }) as SupplierPaymentApiResponse<{ success?: boolean; count?: number; data?: { count?: number } }>

    if (response.success || response.data?.success) {
      const count = response.data?.data?.count || response.data?.count || 0
      success(`已取消 ${count} 台手机的打款`)
      showPaymentDetailsDialog.value = false
      refreshData({ showSuccess: false })
    } else {
      error(response.message || '批量取消打款失败')
    }
  } catch (err: unknown) {
    if (err !== 'cancel') {
      logger.error('批量取消打款失败:', err)
      error(getErrorMessage(err, '批量取消打款失败'))
    }
  } finally {
    removingPayment.value = false
  }
}

// 保存批次详情为图片
const savePaymentDetailsAsImage = async () => {
  if (savingImage.value) return
  try {
    savingImage.value = true

    await nextTick()

    const element = paymentDetailsForCapture.value
    if (!element) {
      error('无法找到要截图的内容')
      return
    }

    const supplierName = paymentDetails.value.supplier_name || '未知供应商'
    const paymentTime = paymentDetails.value.payment_time
      ? TimeUtil.format(paymentDetails.value.payment_time, TIME_FORMATS.DATE)
      : TimeUtil.nowFormatted(TIME_FORMATS.DATE)

    await withCaptureLayout(element, async () => {
      await downloadCaptureImage(element, `打款明细_${supplierName}_${paymentTime}.png`)
    })

    success('图片已保存')
  } catch (err) {
    logger.error('保存图片失败:', err)
    error('保存图片失败')
  } finally {
    savingImage.value = false
  }
}

// 保存批量打款明细为图片
const saveBatchPaymentAsImage = async () => {
  if (savingImage.value) return
  try {
    savingImage.value = true

    await nextTick()

    const element = batchPaymentTableForCapture.value
    if (!element) {
      error('无法找到要截图的内容')
      return
    }

    const supplierName = selectedPhoneObjects.value[0]?.supplier_name || '未知供应商'
    const paymentTime = paymentForm.payment_time
      ? TimeUtil.format(paymentForm.payment_time, TIME_FORMATS.DATE)
      : TimeUtil.nowFormatted(TIME_FORMATS.DATE)

    await withCaptureLayout(element, async () => {
      await downloadCaptureImage(element, `批量打款明细_${supplierName}_${paymentTime}.png`)
    })

    success('图片已保存')
  } catch (err) {
    logger.error('保存图片失败:', err)
    error('保存图片失败')
  } finally {
    savingImage.value = false
  }
}

// 保存单个打款明细为图片
const saveSinglePaymentAsImage = async () => {
  if (savingImage.value) return
  try {
    savingImage.value = true

    await nextTick()

    const element = singlePaymentForCapture.value
    if (!element) {
      error('无法找到要截图的内容')
      return
    }

    const supplierName = currentPhone.value?.supplier_name || '未知供应商'
    const paymentTime = paymentForm.payment_time
      ? TimeUtil.format(paymentForm.payment_time, TIME_FORMATS.DATE)
      : TimeUtil.nowFormatted(TIME_FORMATS.DATE)

    await withCaptureLayout(element, async () => {
      await downloadCaptureImage(element, `单个打款明细_${supplierName}_${paymentTime}.png`)
    })

    success('图片已保存')
  } catch (err) {
    logger.error('保存图片失败:', err)
    error('保存图片失败')
  } finally {
    savingImage.value = false
  }
}

const handleBatchPayment = async () => {
  if (!canCreatePayment.value) {
    handleNoPermission('create')
    return
  }

  if (selectedPhones.value.length === 0) {
    warning('请选择要打款的手机')
    return
  }

  // 验证必填字段
  if (canViewPaymentField('payment_method') && !paymentForm.payment_method) {
    warning('请选择打款方式')
    return
  }
  if (canViewPaymentField('payment_time') && !paymentForm.payment_time) {
    warning('请选择打款时间')
    return
  }

  try {
    submitting.value = true

    const response = await unifiedApi.post('/supplier-payments/batch-payment', {
      phone_ids: selectedPhones.value,
      ...paymentForm,
      payment_time: normalizePaymentDateTime(paymentForm.payment_time),
      payment_remarks: paymentForm.payment_remarks
    })

    if (response.success) {
      success(`成功打款 ${response.data.count} 台手机，共计 ¥${formatAmount(response.data.total_amount)}`)
      showBatchPaymentDialog.value = false
      // 清空选择状态
      clearSelection()
      refreshData({ showSuccess: false })
    }
  } catch (err) {
    logger.error('批量打款失败:', err)
    error('批量打款失败')
  } finally {
    submitting.value = false
  }
}

const handleShowPaymentDetails = async (phone: SupplierPaymentPhone) => {
  try {
    // 直接传递原始的打款时间，不进行时区转换
    // 数据库中存储的是UTC时间，后端会使用YEAR/MONTH/DAY/HOUR/MINUTE函数提取时间部分
    const paymentTime = phone.payment_time

    const response = await unifiedApi.get('/supplier-payments/batch-details', {
      params: {
        supplier_id: phone.supplier_id,
        payment_time: paymentTime
      }
    }) as SupplierPaymentApiResponse<SupplierPaymentPhone[]>

    if (response.success) {
      const detailPhones = Array.isArray(response.data) ? response.data : []

      const totalCost = detailPhones.reduce((sum: number, currentItem) => sum + toNumber(currentItem.purchase_cost), 0)
      const totalSale = detailPhones.reduce((sum: number, currentItem) => sum + toNumber(currentItem.sale_price), 0)
      const totalProfit = totalSale - totalCost

      paymentDetails.value = {
        supplier_name: phone.supplier_name,
        payment_time: phone.payment_time,
        payment_method: phone.payment_method || '',
        payment_operator: phone.payment_operator_name || '',
        payment_remarks: detailPhones[0]?.payment_remarks || phone.payment_remarks || '',
        phones: detailPhones,
        total_cost: totalCost,
        total_sale: totalSale,
        total_profit: totalProfit
      }

      showPaymentDetailsDialog.value = true
    } else {
      error(response.message || '获取打款详情失败')
    }
  } catch (err) {
    logger.error('获取打款详情失败:', err)
    error('获取打款详情失败')
  }
}

const _handlePageChange = (page: number) => {
  pagination.page = page
  loadPhones()
}

// 处理统一分页组件的变化（页码、每页数量）
const handlePaginationChange = (page: number, pageSize: number) => {
  pagination.page = page
  pagination.page_size = pageSize
  // 不再重置选中状态，保持跨页选择
  loadPhones()
}

const refreshData = async (options: { showSuccess?: boolean } = {}) => {
  const { showSuccess = true } = options

  if (refreshing.value) {
    return
  }

  refreshing.value = true
  try {
    unifiedApi.clearCache('/payments')
    await Promise.all([
      loadSummaryStatistics(),
      loadStatistics(false),
      loadPhones(false)
    ])
    if (showSuccess) {
      success('数据刷新成功')
    }
  } finally {
    refreshing.value = false
  }
}

// 重置筛选条件
const resetFilters = () => {
  filters.keyword = ''
  filters.supplier_id = ''
  filters.store_id = ''
  filters.sale_status = 'all'
  filters.payment_status = 'all'
  filters.start_date = ''
  filters.end_date = ''
  syncVisiblePaymentFilters()
  handleFilterChange()
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

const _formatDateTime = (dateString: string | null) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

// 格式化为北京时间（将 UTC 时间转换为北京时间 UTC+8）
const formatDateTimeBeijing = (dateString: string | null) => {
  if (!dateString) return '-'

  const date = new Date(dateString)

  // 检查日期是否有效
  if (isNaN(date.getTime())) return '-'

  // 转换为北京时间（UTC+8）
  const utcTime = date.getTime()
  const beijingTime = new Date(utcTime + (8 * 60 * 60 * 1000))

  const year = beijingTime.getFullYear()
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getDate()).padStart(2, '0')
  const hours = String(beijingTime.getHours()).padStart(2, '0')
  const minutes = String(beijingTime.getMinutes()).padStart(2, '0')
  const seconds = String(beijingTime.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 格式化为北京时间（将 UTC 时间转换为北京时间 UTC+8，只显示年月日）
const formatDateBeijing = (dateString: string | null) => {
  if (!dateString) return '-'

  const date = new Date(dateString)

  // 检查日期是否有效
  if (isNaN(date.getTime())) return '-'

  // 转换为北京时间（UTC+8）
  const utcTime = date.getTime()
  const beijingTime = new Date(utcTime + (8 * 60 * 60 * 1000))

  const year = beijingTime.getFullYear()
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const getPaymentDialogColumnWidth = (
  rows: SupplierPaymentPhone[],
  field: PaymentDialogColumnField
) => {
  const config = paymentDialogColumnConfig[field]
  const values = rows.map((phone) => {
    if (field === 'sale_time' || field === 'payment_time') {
      return formatDateBeijing(phone[field] || null)
    }
    if (field === 'purchase_cost') {
      return `¥${formatAmount(phone.purchase_cost ?? 0)}`
    }
    if (field === 'profit') {
      return `¥${formatAmount(getPhoneProfit(phone))}`
    }
    return phone[field] ?? '-'
  })
  const widthOptions = {
    minWidth: config.minWidth,
    horizontalPadding: field === 'payment_time'
      ? 44
      : field === 'serial_number' || field === 'imei'
        ? 32
        : 40,
    asciiCharacterWidth: 9,
    wideCharacterWidth: 15
  }

  if (field === 'serial_number' || field === 'imei') {
    return getIdentifierColumnMinWidth([config.label, ...values], widthOptions)
  }
  return getTextColumnMinWidth([config.label, ...values], widthOptions)
}

// 获取手机状态文本
const _getPhoneStatusText = (status: string | null) => {
  if (status === 'pending') return '待处理'
  return getPhoneStatusLabel(status)
}

// 获取打款时间的内联样式（精确到分钟区分，小巧精致版）
const getPaymentTimeStyle = (phone: SupplierPaymentPhone): Record<string, string> => {
  if (phone.payment_status !== 'paid' || !phone.payment_time) {
    return {}
  }

  const colorIndex = getPaymentTimeColorIndex(phone.payment_time)
  const color = paymentTimeColors[colorIndex]

  return {
    'background': `linear-gradient(135deg, ${color.bg}, ${color.bg}dd)`,
    'color': color.text,
    'border': `1px solid ${color.text}`,
    'box-shadow': `0 1px 3px ${color.text}30`,
    'font-weight': '500',
    'transition': 'all 0.2s ease'
  }
}

onMounted(async () => {
  if (!canView.value) {
    return
  }

  await initFieldPermissions()
  syncVisiblePaymentFilters()
  loadStores()
  loadSummaryStatistics()
  loadStatistics()
  loadPhones()
})
</script>

<style lang="scss" scoped>
.supplier-phone-payments-view {
  .stat-main-line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .table-section {
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
      background: linear-gradient(135deg, var(--tf-color-amber-surface) 0%, var(--color-bg-white) 45%, var(--tf-color-surface-blue) 100%);
      border: 1px solid var(--tf-color-border-surface);
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
        color: var(--tf-color-neutral-700);
        font-weight: 700;
      }

      .selected-amount {
        font-size: 14px;
        font-weight: 700;
        color: var(--color-warning);
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
        background: var(--tf-button-danger-soft-bg);
        border-color: var(--tf-button-danger-soft-border);
        color: var(--tf-button-danger-soft-color);
        box-shadow: none;

        &:hover,
        &:focus {
          background: var(--tf-button-danger-soft-hover-bg);
          border-color: var(--tf-button-danger-soft-hover-border);
          color: var(--tf-button-danger-soft-hover-color);
        }
      }

      .selected-action-btn-primary {
        background: var(--tf-button-primary-soft-bg);
        border-color: var(--tf-button-primary-soft-border);
        color: var(--tf-button-primary-soft-color);
        box-shadow: none;

        &:hover,
        &:focus {
          background: var(--tf-button-primary-soft-hover-bg);
          border-color: var(--tf-button-primary-soft-hover-border);
          color: var(--tf-button-primary-soft-hover-color);
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
      background: var(--tf-status-danger-bg);
      color: var(--tf-status-danger-color);
      border: 1px solid var(--tf-status-danger-border);
    }

    &.status-paid {
      background: var(--tf-status-success-bg);
      color: var(--tf-status-success-color);
      border: 1px solid var(--tf-status-success-border);
    }

    &.status-in_stock {
      background: var(--tf-status-success-bg);
      color: var(--tf-status-success-color);
      border: 1px solid var(--tf-status-success-border);
    }

    &.status-sold {
      background: var(--tf-status-neutral-bg);
      color: var(--tf-status-neutral-color);
      border: 1px solid var(--tf-status-neutral-border);
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

  // 文本辅助类
  .text-muted {
    color: var(--color-info);
  }

  .text-center {
    text-align: center;
  }

  // 分页样式
  .pagination-wrapper {
    padding: 16px;
    background: var(--color-bg-white);
    border-radius: 8px;
    margin-top: 16px;
  }

  // 批次详情对话框样式
  .payment-details {
    .details-info {
      background: linear-gradient(135deg, var(--tf-color-surface) 0%, var(--tf-color-border-cool-alt) 100%);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      border: 1px solid var(--tf-color-border-element);

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
        border: 1px solid var(--color-border-light);
        transition: all 0.3s ease;

        &:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transform: translateY(-2px);
        }

        label {
          font-size: 13px;
          color: var(--color-info);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        span {
          font-size: 18px;
          color: var(--color-text-primary);
          font-weight: 600;

          &.amount {
            color: var(--color-warning);
            font-family: 'Monaco', 'Consolas', monospace;

            &.profit-positive {
              color: var(--color-success);
            }

            &.profit-negative {
              color: var(--color-danger);
            }
          }

          &.highlight {
            color: var(--color-primary);
            font-size: 20px;
          }

          &.profit-value {
            font-size: 20px;
            font-weight: 700;

            &.profit-positive {
              color: var(--color-success);
            }

            &.profit-negative {
              color: var(--color-danger);
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
          background: var(--tf-color-surface-muted);
          border: 1px solid var(--tf-color-border-element);
        }
      }
    }

  }
}

/* 打款批次详情摘要卡片 */
.payment-details .payment-batch-summary-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 14px;
}

.payment-details .details-info.payment-summary-cards.payment-batch-summary-cards > .info-row:first-child {
  grid-column: auto;
}

.payment-details .payment-batch-summary-cards > .batch-summary-supplier {
  order: 1;
}

.payment-details .payment-batch-summary-cards > .batch-summary-time {
  order: 2;
}

.payment-details .payment-batch-summary-cards > .batch-summary-method {
  order: 3;
}

.payment-details .payment-batch-summary-cards > .batch-summary-operator {
  order: 4;
}

.payment-details .payment-batch-summary-cards > .batch-summary-count {
  order: 5;
}

.payment-details .payment-batch-summary-cards > .batch-summary-cost {
  order: 6;
}

.payment-details .payment-batch-summary-cards > .batch-summary-sales {
  order: 7;
}

.payment-details .payment-batch-summary-cards > .batch-summary-profit {
  order: 8;
}

.payment-details .payment-batch-summary-cards > .batch-summary-remarks {
  grid-column: 1 / -1;
  order: 9;
}

/* 打款表单信息面板：批量和单个打款共用 */
.payment-details .payment-form-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(160px, 1fr));
  align-items: stretch;
  gap: 12px;
  margin-top: 18px;
  padding: 14px;
  border: 1px solid var(--tf-color-slate-200);
  border-radius: 12px;
  background: var(--tf-color-slate-50);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

.payment-details .payment-form-heading {
  grid-column: 1 / -1;
  order: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 0 2px 2px;
}

.payment-details .payment-form-heading-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  border-radius: 8px;
  background: var(--tf-color-slate-900);
  color: var(--color-bg-white);
}

.payment-details .payment-form-heading > span:last-child {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.payment-details .payment-form-heading strong {
  color: var(--tf-color-slate-900);
  font-size: 14px;
  line-height: 1.2;
}

.payment-details .payment-form-heading small {
  color: var(--tf-color-slate-500);
  font-size: 11px;
  line-height: 1.2;
}

.payment-details .payment-form-cards > .payment-method-row {
  --payment-form-accent: var(--tf-color-blue-500);
  order: 1;
}

.payment-details .payment-form-cards > .payment-time-row {
  --payment-form-accent: var(--tf-color-amber-500);
  order: 2;
}

.payment-details .payment-form-cards > .payment-operator-row {
  --payment-form-accent: var(--tf-color-teal-tailwind-500);
  order: 3;
}

.payment-details .payment-form-cards > .payment-remarks-row {
  --payment-form-accent: var(--tf-color-slate-500);
  grid-column: 1 / -1;
  order: 4;
}

.payment-details .payment-form-cards > .info-row {
  position: relative;
  min-width: 0;
  min-height: 88px;
  padding: 14px 12px 12px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 8px;
  overflow: hidden;
  border: 1px solid var(--tf-color-slate-200);
  border-radius: 8px;
  background: var(--color-bg-white);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
}

.payment-details .payment-form-cards > .info-row::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  background: var(--payment-form-accent, var(--tf-color-slate-400));
}

.payment-details .payment-form-cards > .payment-remarks-row {
  min-height: 112px;
}

.payment-details .payment-form-cards > .info-row label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  color: var(--tf-color-slate-600);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.payment-details .payment-form-cards > .info-row label i {
  width: 16px;
  color: var(--payment-form-accent, var(--tf-color-primary-500));
  font-size: 12px;
  text-align: center;
}

.payment-details .payment-form-cards > .info-row > :deep(.el-select),
.payment-details .payment-form-cards > .info-row > :deep(.el-date-picker),
.payment-details .payment-form-cards > .info-row > :deep(.el-input) {
  width: 100%;
  max-width: 100%;
}

.payment-details .payment-form-cards > .info-row :deep(.el-input__wrapper),
.payment-details .payment-form-cards > .info-row :deep(.el-select__wrapper) {
  min-height: 38px;
  border-radius: 6px;
  background: var(--tf-color-surface-muted);
  box-shadow: inset 0 0 0 1px var(--tf-color-border-form);
}

.payment-details .payment-form-cards > .payment-remarks-row :deep(.el-textarea__inner) {
  min-height: 58px;
  padding: 9px 10px;
  border-radius: 6px;
  background: var(--tf-color-surface-muted);
  box-shadow: inset 0 0 0 1px var(--tf-color-border-form);
  resize: vertical;
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
    color: var(--color-primary);
    letter-spacing: 0.6px;
    font-size: 18px;
    line-height: 1.3;
    word-break: break-all;
  }

  // 表单优化
  :deep(.el-form-item__label) {
    font-weight: 600;
    color: var(--color-text-regular);
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
    background: linear-gradient(135deg, var(--tf-color-surface) 0%, var(--tf-color-border-cool-alt) 100%);
    border: 1px solid var(--tf-color-border-element);
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
      border: 1px solid var(--tf-color-border-form);
      background: linear-gradient(180deg, var(--color-bg-white) 0%, var(--tf-color-surface-blue-alt) 100%);
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
        color: var(--tf-color-gray-ui-alt);
        font-weight: 600;
        letter-spacing: 0;
        text-transform: none;
      }

      span {
        display: block;
        min-width: 0;
        font-size: 15px;
        line-height: 1.3;
        color: var(--tf-color-slate-form);
        font-weight: 700;
        word-break: break-word;
      }

      .amount {
        color: var(--tf-color-amber-600);
        font-size: 20px;
        font-weight: 800;
        white-space: nowrap;
      }
    }

    .summary-item-imei {
      &::before {
        background: linear-gradient(90deg, var(--tf-color-blue-500) 0%, var(--tf-color-blue-400) 100%);
      }
    }

    .summary-item-model {
      &::before {
        background: linear-gradient(90deg, var(--tf-color-violet-500) 0%, var(--tf-color-violet-400) 100%);
      }
    }

    .summary-item-cost {
      &::before {
        background: linear-gradient(90deg, var(--tf-color-amber-500) 0%, var(--tf-color-amber-400) 100%);
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
  color: var(--tf-color-gray-bootstrap-700);
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
  color: var(--tf-color-gray-bootstrap-700);
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
  color: var(--tf-color-gray-bootstrap-700);
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
  color: var(--tf-color-gray-bootstrap-700);
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

.data-table tbody tr.mobile-action-expanded {
  border-bottom-color: transparent;
}

/* IMEI 单元格样式 - 两种类名都支持 */
.data-table .imei,
.data-table .imei-cell {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
  font-weight: 600;
  color: var(--tf-color-gray-bootstrap-700);
  letter-spacing: 0.5px;
}

/* 序列号样式 */
.data-table .serial-number {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
  font-weight: 600;
  color: var(--tf-color-gray-bootstrap-700);
  letter-spacing: 0.5px;
}

/* 序号徽章 */
.data-table .index-badge {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  color: var(--color-bg-white);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

/* 时间单元格 */
.data-table .time-cell {
  color: var(--tf-color-heading);
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  text-align: center;
  font-weight: 500;
}

/* 打款时间徽章 */
.data-table .payment-time-badge {
  display: inline-block;
  max-width: 100%;
  padding: 4px 10px;
  box-sizing: border-box;
  background: linear-gradient(135deg, var(--color-danger) 0%, var(--tf-color-red-legacy) 100%);
  color: white;
  border-radius: 12px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(245, 108, 108, 0.3);
}

/* 金额单元格 - 确保居中 */
.data-table .price {
  font-family: 'Monaco', 'Consolas', monospace;
  font-weight: 600;
  color: var(--color-warning);
  text-align: center;
}

/* 利润单元格 - 确保居中 */
.data-table .price-cell {
  font-family: 'Monaco', 'Consolas', monospace;
  font-weight: 600;
  text-align: center;

  &.profit-positive {
    color: var(--color-success);
  }

  &.profit-negative {
    color: var(--color-danger);
  }
}

.data-table .mobile-action-row td {
  padding: 10px 12px;
  background: var(--tf-color-surface-blue);
  border-top: none;
}

.data-table .mobile-row-actions {
  display: flex;
  justify-content: flex-start;
}

.data-table .mobile-action-btn {
  min-width: 92px;
}

/* 复选框样式 */
.data-table input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .payment-list-table-wrapper {
    overflow-x: hidden !important;
    overscroll-behavior-x: contain;
  }

  .supplier-payment-table .status-badge {
    padding-right: 6px;
    padding-left: 6px;
  }

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
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      padding: 12px;
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
      background: linear-gradient(135deg, var(--tf-color-surface) 0%, var(--tf-color-border-cool-alt) 100%);
      border: 1px solid var(--tf-color-border-element);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

      .info-row {
        min-height: 88px;
        background: var(--color-bg-white);
        border: 1px solid var(--color-border-light);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }

      .info-row:first-child {
        grid-column: 1 / -1;
        min-height: 76px;
      }
    }

    .details-info.payment-batch-summary-cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      padding: 0;
      background: transparent;
      border: 0;
      border-radius: 0;
      box-shadow: none;

      > .info-row:first-child {
        grid-column: auto;
        min-height: 78px;
      }

      .info-row {
        --batch-summary-accent: #64748b;
        --batch-summary-tint: #f8fafc;
        min-width: 0;
        min-height: 78px;
        padding: 9px 10px 10px;
        gap: 6px;
        justify-content: center;
        overflow: hidden;
        background: var(--batch-summary-tint);
        border: 1px solid var(--tf-color-slate-200);
        border-top: 3px solid var(--batch-summary-accent);
        border-radius: 8px;
        box-shadow: 0 3px 10px rgba(15, 23, 42, 0.08);

        label {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 0;
          color: var(--tf-color-slate-500);
          font-size: 11px;
          font-weight: 600;
          line-height: 1.2;
          letter-spacing: 0;
          text-transform: none;
          white-space: nowrap;

          i {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            flex: 0 0 22px;
            color: var(--batch-summary-accent);
            font-size: 11px;
            text-align: center;
            background: var(--color-bg-white);
            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 6px;
          }
        }

        span {
          width: 100%;
          color: var(--tf-color-neutral-800);
          font-size: 14px;
          font-weight: 700;
          line-height: 1.25;
          letter-spacing: 0;
          overflow-wrap: anywhere;
          word-break: normal;
        }

        .highlight,
        .amount,
        .profit-value {
          font-size: 15px;
          font-weight: 800;
        }
      }

      @media (min-width: 481px) {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .batch-summary-remarks {
        grid-column: 1 / -1;
        order: 9;
      }

      .batch-summary-supplier {
        --batch-summary-accent: #d97706;
        --batch-summary-tint: #fffbeb;
      }

      .batch-summary-time {
        --batch-summary-accent: #2563eb;
        --batch-summary-tint: #eff6ff;

        span {
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-size: 11px;
          overflow-wrap: normal;
          white-space: normal;
        }
      }

      .batch-summary-method {
        --batch-summary-accent: #7c3aed;
        --batch-summary-tint: #f5f3ff;
      }

      .batch-summary-operator {
        --batch-summary-accent: #0891b2;
        --batch-summary-tint: #ecfeff;
      }

      .batch-summary-count {
        --batch-summary-accent: #475569;
        --batch-summary-tint: #f8fafc;
      }

      .batch-summary-cost {
        --batch-summary-accent: #ca8a04;
        --batch-summary-tint: #fefce8;
      }

      .batch-summary-sales {
        --batch-summary-accent: #0284c7;
        --batch-summary-tint: #f0f9ff;
      }

      .batch-summary-profit {
        --batch-summary-accent: #16a34a;
        --batch-summary-tint: #f0fdf4;

        &.is-negative {
          --batch-summary-accent: #dc2626;
          --batch-summary-tint: #fef2f2;
        }
      }
    }

    .details-info.payment-summary-cards-four {
      display: flex;
      flex-wrap: nowrap;
      align-items: stretch;
      gap: 6px;
      padding: 14px;
      background: linear-gradient(135deg, var(--tf-color-surface) 0%, var(--tf-color-border-cool-alt) 100%);
      border: 1px solid var(--tf-color-border-element);
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
        background: linear-gradient(180deg, var(--color-bg-white) 0%, var(--tf-color-surface-blue-alt) 100%);
        border: 1px solid var(--tf-color-border-form);
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
          background: linear-gradient(90deg, var(--tf-color-slate-400) 0%, var(--tf-color-slate-300) 100%);
        }

        label {
          font-size: 10px;
          margin-bottom: 0;
          letter-spacing: 0;
          color: var(--tf-color-gray-ui-alt);
          font-weight: 600;
          flex-shrink: 0;
          white-space: nowrap;
        }

        span {
          font-size: 13px;
          line-height: 1.2;
          word-break: break-word;
          color: var(--tf-color-slate-form);
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
        background: linear-gradient(180deg, var(--tf-color-amber-surface) 0%, var(--color-bg-white) 100%);
        border-color: var(--tf-color-warning-element-border);

        &::before {
          background: linear-gradient(90deg, var(--tf-color-amber-500) 0%, var(--tf-color-amber-400) 100%);
        }
      }

      .info-row:nth-child(2) {
        background: linear-gradient(180deg, var(--tf-color-indigo-surface-alt) 0%, var(--color-bg-white) 100%);
        border-color: var(--tf-color-blue-tailwind-100);

        &::before {
          background: linear-gradient(90deg, var(--tf-color-blue-500) 0%, var(--tf-color-blue-400) 100%);
        }
      }

      .info-row:nth-child(3) {
        background: linear-gradient(180deg, var(--tf-color-orange-50) 0%, var(--color-bg-white) 100%);
        border-color: var(--tf-color-orange-tailwind-200);

        &::before {
          background: linear-gradient(90deg, var(--tf-color-orange-tailwind-500) 0%, var(--color-warning) 100%);
        }
      }

      .info-row:nth-child(4) {
        background: linear-gradient(180deg, var(--tf-color-green-50) 0%, var(--color-bg-white) 100%);
        border-color: var(--tf-color-green-200);

        &::before {
          background: linear-gradient(90deg, var(--tf-color-green-500) 0%, var(--tf-color-green-400) 100%);
        }
      }
    }

    .details-info.payment-form-cards {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      padding: 10px;
      border-radius: 12px;

      .info-row {
        min-width: 0;
        min-height: 78px;
        padding: 12px 8px 9px;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: center;
        gap: 6px;
        border-radius: 8px;

        label {
          min-width: 0;
          margin-bottom: 0;
          padding-left: 0;
          font-size: 11px;
          line-height: 1.2;
          letter-spacing: 0;
          text-transform: none;
          white-space: nowrap;
        }

        span {
          font-size: 12px;
          line-height: 1.3;
        }

        :deep(.el-select),
        :deep(.el-date-picker),
        :deep(.el-input) {
          width: 100% !important;
          max-width: 100%;
        }

        :deep(.el-input__wrapper),
        :deep(.el-select__wrapper) {
          min-height: 34px;
          padding: 0 8px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.96) !important;
          box-shadow: inset 0 0 0 1px var(--tf-color-border-form-strong) !important;
        }

        :deep(.el-date-editor.el-input),
        :deep(.el-date-editor.el-input__wrapper),
        :deep(.el-select .el-select__wrapper) {
          width: 100% !important;
          max-width: 100%;
        }

        :deep(.el-date-editor .el-input__prefix) {
          display: none;
        }

        :deep(.el-date-editor .el-input__prefix-inner) {
          display: inline-flex;
          align-items: center;
        }

        :deep(.el-input__inner),
        :deep(.el-select__selected-item),
        :deep(.el-date-editor .el-range-input),
        :deep(.el-date-editor .el-input__inner) {
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .payment-form-heading {
        grid-column: 1 / -1;
      }

      .payment-remarks-row {
        grid-column: 1 / -1;
        min-height: 92px;
      }
    }
  }

  .data-table .serial-number,
  .data-table .imei,
  .data-table .imei-cell {
    letter-spacing: 0.3px;
  }

  .data-table .mobile-action-row td {
    padding: 10px 8px;
  }

  .data-table .mobile-action-btn {
    flex: 1 1 calc(50% - 6px);
    min-width: 0;
  }

  .payment-details .details-info.payment-form-cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 14px;
    padding: 10px;
    border-radius: 12px;
  }

  .payment-details .payment-form-cards > .info-row,
  .payment-details .payment-form-cards > .payment-remarks-row {
    min-height: 78px;
    padding: 12px 8px 9px;
  }

  .payment-details .payment-form-cards > .payment-remarks-row {
    min-height: 92px;
    padding: 12px 10px;
  }

  .payment-details .payment-form-cards > .info-row label {
    font-size: 11px;
  }

  .payment-details .payment-form-cards > .info-row label i {
    width: 13px;
    font-size: 11px;
  }

  .payment-details .payment-form-cards > .info-row :deep(.el-input__wrapper),
  .payment-details .payment-form-cards > .info-row :deep(.el-select__wrapper) {
    min-height: 34px;
    padding: 0 8px;
  }

  .payment-details .payment-form-cards > .info-row :deep(.el-date-editor .el-input__prefix) {
    display: none;
  }

  .payment-details .payment-form-cards > .info-row :deep(.el-input__inner),
  .payment-details .payment-form-cards > .info-row :deep(.el-select__selected-item),
  .payment-details .payment-form-cards > .info-row :deep(.el-date-editor .el-input__inner) {
    font-size: 12px;
  }
}
</style>

<style lang="scss">
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
    color: var(--color-bg-white);
    font-weight: 700;
    letter-spacing: 0.2px;
  }

  .el-dialog__headerbtn,
  .mobile-dialog-sheet-close {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: var(--tf-button-overlay-bg);
    color: var(--tf-button-on-color);
    transition: all 0.2s ease;
  }

  .el-dialog__headerbtn:hover,
  .mobile-dialog-sheet-close:hover {
    background: var(--tf-button-overlay-hover-bg);
    transform: translateY(-1px);
  }

  .el-dialog__body {
    padding: 22px 22px 18px;
  }

  .el-dialog__footer,
  .mobile-dialog-sheet-footer {
    padding: 14px 22px 20px;
    border-top: 1px solid var(--tf-color-border-surface);
    background: linear-gradient(180deg, var(--color-bg-white) 0%, var(--tf-color-surface-blue) 100%);
  }
}

.payment-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;

  .el-button span {
    display: inline-flex;
    align-items: center;
  }

  .el-button i {
    margin-right: 6px;
  }
}

.payment-summary-time {
  cursor: help;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}

.supplier-phone-payments-detail-dialog .payment-details .details-info.payment-summary-cards.payment-batch-summary-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.supplier-phone-payments-detail-dialog .payment-details .details-info.payment-summary-cards.payment-batch-summary-cards > .info-row:first-child {
  grid-column: auto;
}

.supplier-phone-payments-detail-dialog .payment-details .details-info.payment-summary-cards.payment-batch-summary-cards > .batch-summary-remarks {
  grid-column: 1 / -1;
  order: 9;
}

@media (max-width: 768px) {
  .supplier-phone-payments-detail-dialog .payment-details .details-info.payment-summary-cards.payment-batch-summary-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

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
  }
}

@media (min-width: 481px) and (max-width: 768px) {
  .supplier-phone-payments-detail-dialog .payment-details .details-info.payment-summary-cards.payment-batch-summary-cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .supplier-phone-payments-dialog {
    .el-dialog__title,
    .mobile-dialog-sheet-title {
      font-size: 15px;
    }
  }

}
</style>
