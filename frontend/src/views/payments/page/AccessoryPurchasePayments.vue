<template>
  <div class="admin-page-content">
    <div
      v-if="summary"
      class="stats-cards accessory-purchase-stats-cards"
      aria-label="商品货款汇总"
    >
      <div
        v-if="visible('payment.payment_status') && visible('payment.purchase_cost')"
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
              ¥{{ formatAmount(summary.unpaid_amount) }}
            </div>
          </div>
          <div class="stat-sub">
            待打款商品货款
          </div>
        </div>
      </div>
      <div
        v-if="visible('payment.payment_status') && visible('payment.purchase_cost')"
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
              ¥{{ formatAmount(summary.paid_amount) }}
            </div>
          </div>
          <div class="stat-sub">
            已登记商品货款
          </div>
        </div>
      </div>
      <div
        v-if="visible('payment.purchase_cost')"
        class="stat-card stat-card--primary"
      >
        <div class="stat-icon">
          <i class="fas fa-coins" />
        </div>
        <div class="stat-content">
          <div class="stat-main-line">
            <div class="stat-label">
              采购总额
            </div>
            <div class="stat-value-primary">
              ¥{{ formatAmount(summary.total_amount) }}
            </div>
          </div>
          <div class="stat-sub">
            {{ total }} 张采购单
          </div>
        </div>
      </div>
      <div
        v-if="visible('purchase.quantity')"
        class="stat-card stat-card--info"
      >
        <div class="stat-icon">
          <i class="fas fa-boxes-stacked" />
        </div>
        <div class="stat-content">
          <div class="stat-main-line">
            <div class="stat-label">
              采购数量
            </div>
            <div class="stat-value-primary">
              {{ summary.total_quantity ?? 0 }}<span class="stat-value-unit">件</span>
            </div>
          </div>
          <div class="stat-sub">
            原始入库采购数量
          </div>
        </div>
      </div>
    </div>

    <UnifiedSearchPanel
      v-model:expanded="searchExpanded"
      :loading="loading"
      @search="search"
      @reset="reset"
    >
      <template #primary>
        <el-input
          v-if="visible('purchase.name') && visible('purchase.batch_no')"
          v-model="keyword"
          placeholder="搜索商品名称、采购批次"
          clearable
        />
      </template>
      <div
        v-if="visible('payment.supplier_name')"
        class="form-group filter-item"
      >
        <el-select
          v-model="supplierName"
          placeholder="供应商名称"
          clearable
          filterable
          allow-create
          default-first-option
          :reserve-keyword="false"
          @focus="loadOptions"
          @clear="search"
        >
          <el-option
            v-for="option in supplierOptions"
            :key="option"
            :label="option"
            :value="option"
          />
        </el-select>
      </div>
      <div
        v-if="visible('payment.brand_name')"
        class="form-group filter-item"
      >
        <el-select
          v-model="brandName"
          placeholder="品牌"
          clearable
          filterable
          allow-create
          default-first-option
          :reserve-keyword="false"
          @focus="loadOptions"
          @clear="search"
        >
          <el-option
            v-for="option in brandOptions"
            :key="option"
            :label="option"
            :value="option"
          />
        </el-select>
      </div>
      <div
        v-if="visible('purchase.name')"
        class="form-group filter-item"
      >
        <el-select
          v-model="productName"
          placeholder="商品名称"
          clearable
          filterable
          allow-create
          default-first-option
          :reserve-keyword="false"
          @focus="loadOptions"
          @clear="search"
        >
          <el-option
            v-for="option in productOptions"
            :key="option"
            :label="option"
            :value="option"
          />
        </el-select>
      </div>
      <div
        v-if="visible('payment.store_name')"
        class="form-group filter-item"
      >
        <el-select
          v-model="storeName"
          placeholder="入库店铺名称"
          clearable
          filterable
          allow-create
          default-first-option
          :reserve-keyword="false"
          @focus="loadOptions"
          @clear="search"
        >
          <el-option
            v-for="option in storeOptions"
            :key="option"
            :label="option"
            :value="option"
          />
        </el-select>
      </div>
      <div
        v-if="visible('payment.payment_status')"
        class="form-group filter-item"
      >
        <el-select
          v-model="paymentStatus"
          aria-label="打款状态"
          @change="search"
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
        v-if="visible('purchase.inventory_time')"
        class="form-group filter-item filter-item--date-range"
      >
        <DateRangePicker
          v-model="dateRange"
          @change="search"
        />
      </div>
    </UnifiedSearchPanel>

    <section
      v-tf-loading="{ active: loading, text: '正在读取商品货款...' }"
      class="table-section admin-panel admin-table-panel"
    >
      <el-alert
        v-if="failed"
        title="商品货款读取失败，请刷新重试"
        type="error"
        :closable="false"
      />
      <div
        v-if="selectedPurchaseRows.length"
        class="selected-info purchase-batch-toolbar"
      >
        <div class="selected-summary">
          <span class="selected-count">已选择{{ selectedPurchaseRows.length }}张单据</span>
          <span
            v-if="visible('payment.purchase_cost')"
            class="selected-amount"
          >
            ，共{{ formatAmount(batchPurchaseAmount) }}元
          </span>
        </div>
        <span
          v-if="batchSupplierConflict"
          class="purchase-batch-warning"
        >
          批量打款需选择同一供应商
        </span>
        <div class="batch-actions-buttons">
          <el-button
            class="tf-button--neutral"
            @click="clearPurchaseSelection"
          >
            <i class="fas fa-times" />
            清空选择
          </el-button>
          <el-button
            v-if="canBatchPay"
            v-permission="'supplier-payments:create'"
            type="primary"
            :disabled="batchSupplierConflict"
            @click="openBatchPayment"
          >
            <i class="fas fa-money-bill-wave" />
            批量打款
          </el-button>
        </div>
      </div>
      <el-table
        v-table-double-tap="mobileDetailTapOptions"
        :data="rows"
        class="data-table"
        row-key="id"
        border
        @selection-change="handlePurchaseSelectionChange"
        @row-dblclick="mobileDetailDoubleClick"
      >
        <el-table-column
          v-if="canBatchPay"
          type="selection"
          width="48"
          :selectable="isBatchSelectable"
        />
        <el-table-column
          label="ID"
          :width="$getNumberColumnWidth(rows.map(row => row.id), 60)"
        >
          <template #default="{ row }">
            <span class="table-number-badge">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('purchase.batch_no')"
          prop="batch_no"
          label="采购批次"
          :min-width="textWidth('batch_no', '采购批次')"
        />
        <el-table-column
          v-if="visible('payment.supplier_name')"
          prop="supplier_name"
          label="供应商"
          :min-width="textWidth('supplier_name', '供应商')"
        />
        <el-table-column
          v-if="visible('payment.store_name')"
          prop="store_name"
          label="入库店铺"
          :min-width="textWidth('store_name', '入库店铺')"
        />
        <el-table-column
          v-if="visible('purchase.name')"
          prop="name"
          label="商品名称"
          :min-width="textWidth('name', '商品名称')"
        >
          <template #default="{ row }">
            {{ row.name ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('purchase.category')"
          prop="category"
          label="商品类型"
          :min-width="textWidth('category', '商品类型')"
        />
        <el-table-column
          v-if="visible('payment.brand_name')"
          prop="brand_name"
          label="品牌"
          :min-width="textWidth('brand_name', '品牌')"
        />
        <el-table-column
          v-if="visible('payment.model_name')"
          prop="product_model"
          label="配件型号"
          :min-width="textWidth('product_model', '配件型号')"
        />
        <el-table-column
          v-if="visible('payment.color_name')"
          prop="color_name"
          label="颜色"
          :min-width="textWidth('color_name', '颜色')"
        />
        <el-table-column
          v-if="visible('purchase.quantity')"
          prop="quantity"
          label="采购数量"
          min-width="100"
        />
        <el-table-column
          v-if="visible('purchase.unit')"
          prop="unit"
          label="单位"
          min-width="80"
        />
        <el-table-column
          v-if="visible('payment.purchase_cost')"
          label="采购单价"
          min-width="110"
        >
          <template #default="{ row }">
            ¥{{ formatAmount(row.purchase_cost) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('payment.purchase_cost')"
          label="整批金额"
          min-width="120"
        >
          <template #default="{ row }">
            ¥{{ formatAmount(row.total_amount) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('purchase.inventory_operator')"
          prop="inventory_operator_name"
          label="入库员"
          :min-width="textWidth('inventory_operator_name', '入库员')"
        />
        <el-table-column
          v-if="visible('purchase.inventory_time')"
          label="入库时间"
          min-width="170"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.inventory_time) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('payment.payment_status')"
          label="打款状态"
          min-width="100"
        >
          <template #default="{ row }">
            <el-tag :type="row.payment_status === 'paid' ? 'success' : 'warning'">
              {{ row.payment_status === 'paid' ? '已打款' : '未打款' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('payment.payment_method')"
          label="打款方式"
          min-width="110"
        >
          <template #default="{ row }">
            {{ getPaymentMethodLabel(row.payment_method) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('payment.payment_time')"
          label="打款时间"
          min-width="170"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.payment_time) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('payment.payment_operator')"
          prop="payment_operator_name"
          label="打款人"
          :min-width="textWidth('payment_operator_name', '打款人')"
        />
        <el-table-column
          v-if="visible('payment.remarks')"
          prop="payment_remarks"
          label="打款备注"
          :min-width="textWidth('payment_remarks', '打款备注')"
        />
        <el-table-column
          v-if="!isMobile && (showActions)"
          label="操作"
          class-name="actions-column"
          :width="purchaseActionColumnWidth"
        >
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                v-if="visible('payment.payment_status')"
                v-permission="'supplier-payments:view'"
                class="table-action--view"
                @click.stop="openHistory(row)"
              >
                记录
              </el-button>
              <el-button
                v-if="canViewReturnContext"
                v-permission="{ permission: ['supplier-payments:view', 'accessories:view'], mode: 'all' }"
                class="table-action--view"
                @click.stop="openReturnContext(row)"
              >
                退供核对
              </el-button>
              <el-button
                v-if="canRegister(row)"
                v-permission="'supplier-payments:create'"
                class="table-action--finance"
                @click.stop="openPayment(row, 'pay')"
              >
                登记打款
              </el-button>
              <el-button
                v-if="canCancel(row)"
                v-permission="'supplier-payments:edit'"
                class="table-action--warning"
                @click.stop="openPayment(row, 'cancel')"
              >
                撤销登记
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <DataEmptyState
            v-if="!loading"
            :description="failed ? '读取失败，请刷新重试' : '暂无商品货款记录'"
            size="compact"
          />
        </template>
      </el-table>
      <RecordDetailDialog
        v-model="mobileDetailVisible"
        title="采购应付详情"
        :record="mobileDetailRow"
        :fields="mobileDetailFields"
        :has-actions="mobileDetailRow !== null && (visible('payment.payment_status') || canViewReturnContext || canRegister(mobileDetailRow) || canCancel(mobileDetailRow))"
      >
        <template #actions="{ row }">
          <el-button
            v-if="visible('payment.payment_status')"
            v-permission="'supplier-payments:view'"
            class="table-action--view"
            @click.stop="mobileDetailRunAction(() => openHistory(row))"
          >
            记录
          </el-button>
          <el-button
            v-if="canViewReturnContext"
            v-permission="{ permission: ['supplier-payments:view', 'accessories:view'], mode: 'all' }"
            class="table-action--view"
            @click.stop="mobileDetailRunAction(() => openReturnContext(row))"
          >
            退供核对
          </el-button>
          <el-button
            v-if="canRegister(row)"
            v-permission="'supplier-payments:create'"
            class="table-action--finance"
            @click.stop="mobileDetailRunAction(() => openPayment(row, 'pay'))"
          >
            登记打款
          </el-button>
          <el-button
            v-if="canCancel(row)"
            v-permission="'supplier-payments:edit'"
            class="table-action--warning"
            @click.stop="mobileDetailRunAction(() => openPayment(row, 'cancel'))"
          >
            撤销登记
          </el-button>
        </template>
      </RecordDetailDialog>

      <Pagination
        :current="page"
        :page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100, 200]"
        :show-total="true"
        :show-range="true"
        :show-page-sizes="true"
        :show-quick-jumper="true"
        :disabled="loading"
        @change="changePage"
      />
    </section>

    <AccessoryPurchaseReturnContext
      v-model:visible="returnContextVisible"
      :purchase-id="returnPurchaseId"
    />

    <MobileDialog
      :model-value="!!editing"
      :title="action === 'pay' ? '登记商品货款' : '撤销商品货款登记'"
      width="620px"
      :close-on-click-modal="false"
      :show-default-footer="false"
      destroy-on-close
      @update:model-value="closePayment"
    >
      <el-form
        v-if="editing"
        class="tf-form-layout tf-form-grid"
        label-position="top"
        @submit.prevent="submit"
      >
        <RecordDescriptions
          :column="1"
          border
        >
          <el-descriptions-item
            v-if="visible('purchase.batch_no')"
            label="采购批次"
          >
            {{ editing.batch_no }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="visible('payment.supplier_name')"
            label="供应商"
          >
            {{ editing.supplier_name }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="visible('purchase.name')"
            :label="editing.has_snapshot ? '商品名称（入库时）' : '商品名称（当前档案）'"
          >
            {{ editing.name }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="visible('payment.purchase_cost')"
            label="整批金额"
          >
            ¥{{ formatAmount(editing.total_amount) }}
          </el-descriptions-item>
        </RecordDescriptions>
        <el-form-item
          v-if="action === 'pay' && visible('payment.payment_method')"
          label="打款方式"
          required
        >
          <PaymentMethodSelect
            v-model="form.payment_method"
            variant="settlement"
            :disabled="saving"
          />
        </el-form-item>
        <el-form-item
          v-if="action === 'pay' && visible('payment.payment_time')"
          label="打款时间"
          required
        >
          <el-date-picker
            v-model="form.payment_time"
            type="datetime"
            :format="TIME_FORMATS.DATETIME"
            :value-format="TIME_FORMATS.DATETIME"
            :disabled="saving"
          />
        </el-form-item>
        <el-form-item
          v-if="visible('payment.remarks')"
          class="tf-form-field--wide"
          :label="action === 'cancel' ? '撤销原因' : '打款备注'"
          :required="action === 'cancel'"
        >
          <el-input
            v-model="form.remarks"
            type="textarea"
            class="tf-textarea"
            :rows="2"
            :maxlength="1000"
            :disabled="saving"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button
            :disabled="saving"
            @click="closePayment(false)"
          >
            取消
          </el-button>
          <el-button
            v-if="action === 'pay'"
            v-permission="'supplier-payments:create'"
            type="primary"
            :loading="saving"
            :disabled="!canSubmit"
            @click="submit"
          >
            确认登记
          </el-button>
          <el-button
            v-else
            v-permission="'supplier-payments:edit'"
            type="warning"
            :loading="saving"
            :disabled="!canSubmit"
            @click="submit"
          >
            确认撤销
          </el-button>
        </div>
      </template>
    </MobileDialog>

    <MobileDialog
      v-model="batchPaymentVisible"
      title="批量登记商品货款"
      width="95%"
      dialog-class="accessory-purchase-batch-dialog"
      :style="{ maxWidth: '1280px' }"
      :close-on-click-modal="false"
      :show-default-footer="false"
      destroy-on-close
    >
      <div class="payment-details accessory-batch-payment-details">
        <div class="details-info payment-summary-cards payment-summary-cards-four">
          <div
            v-if="visible('payment.supplier_name')"
            class="info-row"
          >
            <label>供应商:</label>
            <span>{{ batchSupplierName || '-' }}</span>
          </div>
          <div class="info-row">
            <label>采购单:</label>
            <span class="highlight">{{ selectedPurchaseRows.length }} 张</span>
          </div>
          <div
            v-if="visible('payment.purchase_cost')"
            class="info-row"
          >
            <label>商品货款:</label>
            <span class="amount">¥{{ formatAmount(batchPurchaseAmount) }}</span>
          </div>
          <div
            v-if="visible('purchase.quantity')"
            class="info-row"
          >
            <label>采购数量:</label>
            <span class="highlight">{{ batchPurchaseQuantity }} 件</span>
          </div>
        </div>

        <div class="batch-details-table">
          <div class="table-responsive payment-dialog-table-container">
            <el-table
              :data="selectedPurchaseRows"
              border
              stripe
              row-key="id"
              class="data-table devices-table payment-detail-table"
            >
              <el-table-column
                label="序号"
                :width="$getNumberColumnWidth(selectedPurchaseRows.map((_row, index) => index + 1), 60)"
                align="center"
              >
                <template #default="{ $index }">
                  <span class="table-number-badge">{{ $index + 1 }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="visible('purchase.batch_no')"
                prop="batch_no"
                label="采购批次"
                min-width="130"
              />
              <el-table-column
                v-if="visible('purchase.name')"
                prop="name"
                label="商品名称"
                min-width="140"
              />
              <el-table-column
                v-if="visible('payment.brand_name')"
                prop="brand_name"
                label="品牌"
                min-width="90"
              />
              <el-table-column
                v-if="visible('payment.model_name')"
                prop="product_model"
                label="配件型号"
                min-width="120"
              />
              <el-table-column
                v-if="visible('payment.color_name')"
                prop="color_name"
                label="颜色"
                min-width="90"
              />
              <el-table-column
                v-if="visible('purchase.quantity')"
                label="采购数量"
                min-width="100"
              >
                <template #default="{ row }">
                  {{ row.quantity ?? '-' }} {{ row.unit || '' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="visible('payment.purchase_cost')"
                label="采购单价"
                min-width="110"
              >
                <template #default="{ row }">
                  ¥{{ formatAmount(row.purchase_cost) }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="visible('payment.purchase_cost')"
                label="整批金额"
                min-width="110"
              >
                <template #default="{ row }">
                  ¥{{ formatAmount(row.total_amount) }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="visible('payment.store_name')"
                prop="store_name"
                label="入库店铺"
                min-width="110"
              />
            </el-table>
          </div>
        </div>

        <div class="details-info payment-form-cards accessory-batch-payment-form">
          <div class="payment-form-heading">
            <span class="payment-form-heading-icon"><i class="fas fa-pen-to-square" /></span>
            <span>
              <strong>打款信息</strong>
              <small>确认本次商品货款付款记录</small>
            </span>
          </div>
          <div
            v-if="visible('payment.payment_method')"
            class="info-row payment-method-row"
          >
            <label><i class="fas fa-credit-card" />打款方式</label>
            <PaymentMethodSelect
              v-model="batchPaymentForm.payment_method"
              variant="settlement"
              placeholder="请选择打款方式"
              :disabled="batchPaymentSaving"
            />
          </div>
          <div
            v-if="visible('payment.payment_time')"
            class="info-row payment-time-row"
          >
            <label><i class="fas fa-calendar-day" />打款时间</label>
            <el-date-picker
              v-model="batchPaymentForm.payment_time"
              type="datetime"
              :format="TIME_FORMATS.DATETIME"
              :value-format="TIME_FORMATS.DATETIME"
              :disabled="batchPaymentSaving"
            />
          </div>
          <div
            v-if="visible('payment.remarks')"
            class="info-row payment-remarks-row"
          >
            <label><i class="fas fa-note-sticky" />备注</label>
            <el-input
              v-model="batchPaymentForm.remarks"
              type="textarea"
              class="tf-textarea"
              :rows="2"
              :maxlength="1000"
              placeholder="填写本次打款备注（可选）"
              :disabled="batchPaymentSaving"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button
            :disabled="batchPaymentSaving"
            @click="batchPaymentVisible = false"
          >
            取消
          </el-button>
          <el-button
            v-permission="'supplier-payments:create'"
            type="primary"
            :loading="batchPaymentSaving"
            :disabled="!canSubmitBatchPayment"
            @click="submitBatchPayment"
          >
            确认批量打款
          </el-button>
        </div>
      </template>
    </MobileDialog>

    <MobileDialog
      :model-value="!!historyPurchase"
      title="商品货款记录"
      width="1000px"
      :show-default-footer="false"
      destroy-on-close
      @update:model-value="closeHistory"
    >
      <div v-tf-loading="{ active: historyLoading, text: '正在读取采购打款历史...' }">
        <el-alert
          v-if="historyFailed"
          title="历史记录读取失败，请重试"
          type="error"
          :closable="false"
        />
        <el-button
          :disabled="historyLoading"
          @click="loadHistory"
        >
          刷新记录
        </el-button>
        <el-table
          :data="history"
          class="data-table"
          row-key="id"
        >
          <el-table-column
            label="ID"
            :width="$getNumberColumnWidth(history.map(row => row.id), 60)"
          >
            <template #default="{ row }">
              <span class="table-number-badge">{{ row.id }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="visible('payment.payment_status')"
            label="记录类型"
            min-width="110"
          >
            <template #default="{ row }">
              {{ row.action === 'pay' ? '登记打款' : '撤销登记' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="visible('payment.purchase_cost')"
            label="金额"
            min-width="120"
          >
            <template #default="{ row }">
              ¥{{ formatAmount(row.amount) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="visible('payment.payment_method')"
            label="打款方式"
            min-width="110"
          >
            <template #default="{ row }">
              {{ getPaymentMethodLabel(row.payment_method) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="visible('payment.payment_time')"
            label="原打款时间"
            min-width="170"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.payment_time) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="visible('payment.payment_time')"
            label="登记时间"
            min-width="170"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="visible('payment.payment_operator')"
            prop="operator_name"
            label="操作员"
            min-width="110"
          />
          <el-table-column
            v-if="visible('payment.remarks')"
            prop="remarks"
            label="备注/撤销原因"
            min-width="180"
          />
          <el-table-column
            label="关联原记录"
            :width="$getNumberColumnWidth(history.map(row => row.reference_event_id || 0), 110)"
          >
            <template #default="{ row }">
              <span
                v-if="row.reference_event_id"
                class="table-number-badge"
              >{{ row.reference_event_id }}</span><span v-else>-</span>
            </template>
          </el-table-column>
          <template #empty>
            <DataEmptyState
              v-if="!historyLoading"
              :description="historyFailed ? '读取失败，请重试' : '暂无打款登记'"
              size="compact"
            />
          </template>
        </el-table>
        <Pagination
          :current="historyPage"
          :page-size="20"
          :total="historyTotal"
          :disabled="historyLoading"
          :show-page-sizes="false"
          @change="changeHistoryPage"
        />
      </div>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import type { RecordDetailField } from '@/types/component'
import { computed, reactive, ref, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useAccessoryPurchaseReturnPermissions } from '@/composables/useAccessoryPurchaseReturnPermissions'
import AccessoryPurchaseReturnContext from './AccessoryPurchaseReturnContext.vue'
import { useNotification } from '@/composables/useNotification'
import { formatAmount, formatDateTime } from '@/utils/format'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { getPaymentMethodLabel, SETTLEMENT_PAYMENT_METHODS } from '@/constants/paymentMethods'
import { getAdaptiveActionColumnWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import Pagination from '@/components/Pagination.vue'
import { PaymentMethodSelect } from '@/components/payment'
import type { DateRangeValue } from '@/types/date-range'
import type { AccessoryPurchaseRecord, AccessoryPurchaseSummary, AccessoryPurchasePaymentEvent, AccessoryPurchasePaymentInput, AccessoryPurchasePaymentResult } from '@/types/accessory'

const emit = defineEmits<{ 'open-payment-batch': [batchId: string] }>()
const { canView, canCreate, canEdit } = usePagePermissions('supplier-payments')
const { canViewReturnContext } = useAccessoryPurchaseReturnPermissions()
const returnPurchaseId = ref(0), returnContextVisible = ref(false)
const openReturnContext = (row: AccessoryPurchaseRecord) => {
  if (!canViewReturnContext.value) return
  returnPurchaseId.value = row.id; returnContextVisible.value = true
}
const notifications = useNotification()
const visible = (field: string) => fieldPermissions.isFieldVisible('payments_supplierphonepaymentsview', field)
const requests = useLatestRequest()
const historyRequests = useLatestRequest()
const rows = ref<AccessoryPurchaseRecord[]>([])
const summary = ref<AccessoryPurchaseSummary>()
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const loading = ref(false)
const failed = ref(false)
const keyword = ref('')
const supplierName = ref('')
const brandName = ref('')
const productName = ref('')
const storeName = ref('')
const paymentStatus = ref('all')
const dateRange = ref<DateRangeValue>([])
const searchExpanded = ref(false)
const editing = ref<AccessoryPurchaseRecord | null>(null)
const action = ref<'pay' | 'cancel'>('pay')
const saving = ref(false)
const form = reactive({ payment_method: 'bank_transfer', payment_time: '', remarks: '' })
const selectedPurchaseRows = ref<AccessoryPurchaseRecord[]>([])
const batchPaymentVisible = ref(false)
const batchPaymentSaving = ref(false)
const batchPaymentForm = reactive({ payment_method: 'bank_transfer', payment_time: '', remarks: '' })
const historyPurchase = ref<AccessoryPurchaseRecord | null>(null)
const history = ref<AccessoryPurchasePaymentEvent[]>([])
const historyPage = ref(1)
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyFailed = ref(false)
const optionsLoaded = ref(false)
const optionsLoading = ref(false)
const optionLists = reactive({ suppliers: [] as string[], brands: [] as string[], products: [] as string[], stores: [] as string[] })
let requestKey = ''
let requestSignature = ''
let batchPaymentRequestKey = ''
let batchPaymentRequestSignature = ''

const canOperate = computed(() => ['payment.supplier_name', 'payment.purchase_cost', 'payment.payment_status', 'system_info.operations'].every(visible))
const canRegister = (row: AccessoryPurchaseRecord) => canCreate.value && canOperate.value && row.payment_status === 'unpaid' && Number(row.total_amount) > 0 && ['payment.payment_method', 'payment.payment_time'].every(visible)
const canBatchPay = computed(() => canCreate.value && canOperate.value && visible('payment.payment_method') && visible('payment.payment_time'))
const batchSupplierIds = computed(() => [...new Set(selectedPurchaseRows.value.map(row => Number(row.supplier_id)).filter(id => Number.isInteger(id) && id > 0))])
const batchSupplierConflict = computed(() => batchSupplierIds.value.length !== 1 || selectedPurchaseRows.value.some(row => !canRegister(row)))
const batchSupplierId = computed(() => batchSupplierIds.value.length === 1 ? batchSupplierIds.value[0] : null)
const batchSupplierName = computed(() => selectedPurchaseRows.value[0]?.supplier_name || '')
const batchPurchaseAmount = computed(() => selectedPurchaseRows.value.reduce((sum, row) => sum + Number(row.total_amount || 0), 0))
const batchPurchaseQuantity = computed(() => selectedPurchaseRows.value.reduce((sum, row) => sum + Number(row.quantity || 0), 0))
const canSubmitBatchPayment = computed(() => !batchPaymentSaving.value && batchPaymentVisible.value && !!selectedPurchaseRows.value.length && !batchSupplierConflict.value && !!batchSupplierId.value && !!batchPaymentForm.payment_method && !!batchPaymentForm.payment_time && SETTLEMENT_PAYMENT_METHODS.some(item => item.value === batchPaymentForm.payment_method))
const canCancel = (row: AccessoryPurchaseRecord) => canEdit.value && canOperate.value && row.payment_status === 'paid' && visible('payment.remarks')
const showActions = computed(() => canView.value && shouldShowActionColumn(visible('system_info.operations'), [
  visible('payment.payment_status'), canViewReturnContext.value, rows.value.some(row => canRegister(row) || canCancel(row))
]))
const purchaseActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(rows.value, [
  { label: '记录', visible: visible('payment.payment_status') },
  { label: '退供核对', visible: canViewReturnContext.value },
  { label: '登记打款', visible: canRegister }, { label: '撤销登记', visible: canCancel }
]))
const textWidth = (field: keyof AccessoryPurchaseRecord, label: string) => getTextColumnMinWidth([label, ...rows.value.map(row => String(row[field] ?? ''))], { minWidth: 100 })
const optionValues = (field: keyof AccessoryPurchaseRecord, selected: string, source: string[]) => [...new Set([...source, ...rows.value.map(row => String(row[field] ?? '').trim()), selected.trim()])].filter(Boolean)
const supplierOptions = computed(() => optionValues('supplier_name', supplierName.value, optionLists.suppliers))
const brandOptions = computed(() => optionValues('brand_name', brandName.value, optionLists.brands))
const productOptions = computed(() => optionValues('name', productName.value, optionLists.products))
const storeOptions = computed(() => optionValues('store_name', storeName.value, optionLists.stores))
const loadOptions = async () => {
  if (optionsLoaded.value || optionsLoading.value || !canView.value) return
  optionsLoading.value = true
  try {
    const response = await unifiedApi.get<{ suppliers?: string[]; brands?: string[]; products?: string[]; stores?: string[] }>('/supplier-payments/accessory-purchases/options', { showLoading: false, useCache: false })
    if (response.success === false || !response.data) return
    for (const key of ['suppliers', 'brands', 'products', 'stores'] as const) {
      optionLists[key] = Array.isArray(response.data[key]) ? response.data[key].map(value => String(value).trim()).filter(Boolean) : []
    }
    optionsLoaded.value = true
  } catch { /* 公共API已展示错误，保留当前页候选并允许下次重新加载。 */ }
  finally { optionsLoading.value = false }
}
const canSubmit = computed(() => !saving.value && !!editing.value && (action.value === 'pay'
  ? canRegister(editing.value) && !!form.payment_time && SETTLEMENT_PAYMENT_METHODS.some(item => item.value === form.payment_method)
  : canCancel(editing.value) && !!form.remarks.trim()))
const load = async () => {
  if (!canView.value) return
  const request = requests.nextRequest()
  loading.value = true
  failed.value = false
  try {
    const response = await unifiedApi.get<AccessoryPurchaseRecord[], AccessoryPurchaseSummary>('/supplier-payments/accessory-purchases', {
      params: { page: page.value, page_size: pageSize.value,
        ...(visible('purchase.name') && visible('purchase.batch_no') && keyword.value.trim() ? { keyword: keyword.value.trim() } : {}),
        ...(visible('purchase.name') && productName.value.trim() ? { product_name: productName.value.trim() } : {}),
        ...(visible('payment.brand_name') && brandName.value.trim() ? { brand_name: brandName.value.trim() } : {}),
        ...(visible('payment.supplier_name') && supplierName.value.trim() ? { supplier_name: supplierName.value.trim() } : {}),
        ...(visible('payment.store_name') && storeName.value.trim() ? { store_name: storeName.value.trim() } : {}),
        ...(visible('payment.payment_status') ? { payment_status: paymentStatus.value } : {}),
        ...(visible('purchase.inventory_time') && dateRange.value?.[0] ? { start_date: dateRange.value[0] } : {}),
        ...(visible('purchase.inventory_time') && dateRange.value?.[1] ? { end_date: dateRange.value[1] } : {}) },
      signal: request.signal, showLoading: false, useCache: false
    })
    if (!request.isLatest()) return
    if (!Array.isArray(response.data) || response.data.some(row => !row || typeof row.has_snapshot !== 'boolean') ||
      !response.pagination || !response.summary) throw new Error('采购响应不完整')
    rows.value = response.data
    total.value = response.pagination.total
    summary.value = response.summary
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) { failed.value = true; rows.value = []; total.value = 0; summary.value = undefined }
  } finally { if (request.isLatest()) loading.value = false }
}
const search = () => { clearPurchaseSelection(); page.value = 1; void load() }
const reset = () => { keyword.value = ''; productName.value = ''; brandName.value = ''; supplierName.value = ''; storeName.value = ''; paymentStatus.value = 'all'; dateRange.value = []; search() }
const changePage = (value: number, size: number) => {
  clearPurchaseSelection()
  page.value = value
  pageSize.value = size
  void load()
}
const isBatchSelectable = (row: AccessoryPurchaseRecord) => canRegister(row)
const handlePurchaseSelectionChange = (rows: AccessoryPurchaseRecord[]) => {
  selectedPurchaseRows.value = rows.filter(row => canRegister(row))
}
const clearPurchaseSelection = () => {
  selectedPurchaseRows.value = []
}
const openBatchPayment = () => {
  if (!canBatchPay.value) return
  if (batchSupplierConflict.value) {
    notifications.warning('批量打款需选择同一供应商的未打款采购单')
    return
  }
  batchPaymentForm.payment_method = 'bank_transfer'
  batchPaymentForm.payment_time = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
  batchPaymentForm.remarks = ''
  batchPaymentRequestKey = batchPaymentRequestSignature = ''
  batchPaymentVisible.value = true
}
const submitBatchPayment = async () => {
  if (!canSubmitBatchPayment.value || !batchSupplierId.value) return
  batchPaymentSaving.value = true
  const payload = {
    supplier_id: batchSupplierId.value,
    phone_ids: [],
    accessory_purchase_ids: selectedPurchaseRows.value.map(row => row.id),
    payment_method: batchPaymentForm.payment_method,
    payment_time: batchPaymentForm.payment_time,
    actual_amount: batchPurchaseAmount.value,
    external_reference: '',
    remarks: batchPaymentForm.remarks.trim()
  }
  const signature = JSON.stringify(payload)
  if (signature !== batchPaymentRequestSignature) {
    batchPaymentRequestSignature = signature
    batchPaymentRequestKey = [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('')
  }
  try {
    const response = await unifiedApi.post('/supplier-payments/unified-batches', { ...payload, request_key: batchPaymentRequestKey }, { showLoading: false })
    if (response.success === false) return
    notifications.success(response.data?.replayed ? '该批量打款请求已处理，正在刷新当前状态' : `批量登记 ${selectedPurchaseRows.value.length} 张商品采购单成功`)
    batchPaymentVisible.value = false
    clearPurchaseSelection()
    batchPaymentRequestKey = batchPaymentRequestSignature = ''
    await load()
  } catch { /* 公共API已展示失败原因，保留表单和请求标识供重试。 */ }
  finally { batchPaymentSaving.value = false }
}
const openPayment = (row: AccessoryPurchaseRecord, kind: 'pay' | 'cancel') => {
  if (saving.value || (kind === 'pay' ? !canRegister(row) : !canCancel(row))) return
  editing.value = row
  action.value = kind
  form.payment_method = 'bank_transfer'
  form.payment_time = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
  form.remarks = ''
  requestKey = requestSignature = ''
}
const closePayment = (value: boolean) => { if (!value && !saving.value) editing.value = null }
const submit = async () => {
  if (!canSubmit.value || !editing.value) return
  saving.value = true
  const input: AccessoryPurchasePaymentInput = { expected_event_id: Number(editing.value.latest_event_id || 0), request_key: '' }
  if (action.value === 'pay') { input.payment_method = form.payment_method; input.payment_time = form.payment_time }
  if (visible('payment.remarks')) input.remarks = form.remarks.trim()
  const signature = JSON.stringify([editing.value.id, action.value, input])
  if (signature !== requestSignature) {
    requestSignature = signature
    requestKey = [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('')
  }
  input.request_key = requestKey
  try {
    const response = await unifiedApi.post<AccessoryPurchasePaymentResult>(`/supplier-payments/accessory-purchases/${editing.value.id}/${action.value === 'pay' ? 'payment' : 'cancel-payment'}`, input, { showLoading: false })
    if (response.success === false) return
    notifications.success(response.data?.replayed ? '该请求已处理，正在刷新当前状态' : action.value === 'pay' ? '采购打款已登记' : '采购打款登记已撤销')
    editing.value = null
    await load()
  } catch { /* 公共API展示失败原因；保留表单及请求标识供重试。 */ }
  finally { saving.value = false }
}
const loadHistory = async () => {
  if (!historyPurchase.value || !canView.value || !visible('payment.payment_status')) return
  const request = historyRequests.nextRequest()
  historyLoading.value = true
  historyFailed.value = false
  try {
    const response = await unifiedApi.get<AccessoryPurchasePaymentEvent[]>(`/supplier-payments/accessory-purchases/${historyPurchase.value.id}/payments`, {
      params: { page: historyPage.value, page_size: 20 }, signal: request.signal, showLoading: false, useCache: false
    })
    if (!request.isLatest()) return
    if (!response.data || !response.pagination) throw new Error('历史响应不完整')
    history.value = response.data
    historyTotal.value = response.pagination.total
  } catch (error) {
    if (request.isLatest() && !historyRequests.isCanceledError(error)) { historyFailed.value = true; history.value = []; historyTotal.value = 0 }
  } finally { if (request.isLatest()) historyLoading.value = false }
}
const openHistory = (row: AccessoryPurchaseRecord) => {
  if (!canView.value || !visible('payment.payment_status')) return
  if (row.payment_batch_id) {
    emit('open-payment-batch', row.payment_batch_id)
    return
  }
  historyPurchase.value = row; historyPage.value = 1; history.value = []; historyTotal.value = 0; void loadHistory()
}
const closeHistory = (value: boolean) => { if (!value) { historyPurchase.value = null; historyRequests.cancelLatest(); historyLoading.value = false } }
const changeHistoryPage = (value: number) => { historyPage.value = value; void loadHistory() }
watch(() => [canView.value, fieldPermissions.permissions.value] as const, ([allowed]) => {
  requests.cancelLatest(); historyRequests.cancelLatest()
  rows.value = []; history.value = []; summary.value = undefined; total.value = historyTotal.value = 0
  loading.value = historyLoading.value = false
  if (!saving.value) editing.value = null
  historyPurchase.value = null
  if (allowed) { page.value = 1; void load() }
}, { immediate: true })
defineExpose({ refresh: load, loading })

const { isMobile } = useMobile()
const { detailRow: mobileDetailRow, detailVisible: mobileDetailVisible, doubleTapOptions: mobileDetailTapOptions, handleRowDoubleClick: mobileDetailDoubleClick, runDetailAction: mobileDetailRunAction } = useMobileTableDetail<AccessoryPurchaseRecord>({
  enabled: () => isMobile.value && canView.value, rows: () => rows.value, getKey: row => row.id
})
const mobileDetailFields = computed<RecordDetailField[]>(() => {
  const row = mobileDetailRow.value
  if (!row) return []
  return [
    { key: 'field0', label: 'ID', value: row.id, visible: canView.value },
    { key: 'batch_no', label: '采购批次', value: row.batch_no, visible: visible('purchase.batch_no'), wide: true },
    { key: 'supplier_name', label: '供应商', value: row.supplier_name, visible: visible('payment.supplier_name') },
    { key: 'store_name', label: '入库店铺', value: row.store_name, visible: visible('payment.store_name') },
    { key: 'name', label: '商品名称', value: row.name, visible: visible('purchase.name'), wide: true },
    { key: 'has_snapshot', label: '资料来源', value: row.has_snapshot ? '入库时资料' : '当前档案（旧单无快照）', visible: visible('purchase.name'), wide: true },
    { key: 'category', label: '商品类型', value: row.category, visible: visible('purchase.category') },
    { key: 'brand_name', label: '品牌', value: row.brand_name, visible: visible('payment.brand_name') },
    { key: 'product_model', label: '配件型号', value: row.product_model, visible: visible('payment.model_name'), wide: true },
    { key: 'color_name', label: '颜色', value: row.color_name, visible: visible('payment.color_name') },
    { key: 'quantity', label: '采购数量', value: row.quantity, visible: visible('purchase.quantity') },
    { key: 'unit', label: '单位', value: row.unit, visible: visible('purchase.unit') },
    { key: 'field11', label: '采购单价', value: formatAmount(row.purchase_cost), visible: visible('payment.purchase_cost') },
    { key: 'field12', label: '整批金额', value: formatAmount(row.total_amount), visible: visible('payment.purchase_cost') },
    { key: 'inventory_operator_name', label: '入库员', value: row.inventory_operator_name, visible: visible('purchase.inventory_operator') },
    { key: 'field14', label: '入库时间', value: formatDateTime(row.inventory_time), visible: visible('purchase.inventory_time'), wide: true },
    { key: 'field15', label: '打款状态', value: row.payment_status === 'paid' ? '已打款' : '未打款', visible: visible('payment.payment_status') },
    { key: 'field16', label: '打款方式', value: getPaymentMethodLabel(row.payment_method), visible: visible('payment.payment_method') },
    { key: 'field17', label: '打款时间', value: formatDateTime(row.payment_time), visible: visible('payment.payment_time'), wide: true },
    { key: 'payment_operator_name', label: '打款人', value: row.payment_operator_name, visible: visible('payment.payment_operator') },
    { key: 'payment_remarks', label: '打款备注', value: row.payment_remarks, visible: visible('payment.remarks'), wide: true }
  ]
})

</script>

<style scoped lang="scss" src="./styles/accessory-purchase-payments.scss"></style>
