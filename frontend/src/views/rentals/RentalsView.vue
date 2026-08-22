<template>
  <PermissionGate :can-view="canView" mode="denied" module-key="rentals" module-name="租赁管理" permission-code="rentals:view">
    <div class="rentals-view admin-page">
      <PageHeader title="租赁管理">
        <template #actions>
          <el-button v-if="canCreate" type="primary" @click="openCreateDialog">
            <i class="fas fa-plus"></i><span>新建合同</span>
          </el-button>
          <el-button type="info" :loading="loading" @click="loadRentals">
            <i class="fas fa-sync-alt"></i><span>刷新</span>
          </el-button>
        </template>
      </PageHeader>

      <div class="rentals-content admin-page-content">
        <div class="stats-grid">
          <div class="stat-card"><strong>{{ summary.active }}</strong><span>进行中合同</span></div>
          <div class="stat-card"><strong>{{ summary.devices }}</strong><span>租赁设备</span></div>
          <div class="stat-card"><strong>¥{{ formatMoney(summary.receivable) }}</strong><span>待付租金</span></div>
          <div class="stat-card"><strong>¥{{ formatMoney(summary.deposits) }}</strong><span>在租押金</span></div>
        </div>

        <section class="table-section admin-panel admin-table-panel">
          <div class="panel-heading">
            <h3>租赁合同</h3>
          </div>
          <UnifiedSearchPanel v-model:expanded="searchExpanded" :loading="loading" @search="handleSearch" @reset="resetSearch">
            <template #primary>
              <el-input v-model="filters.keyword" placeholder="合同、客户、手机号、IMEI" clearable @keyup.enter="handleSearch">
                <template #prefix><i class="fas fa-search"></i></template>
              </el-input>
            </template>
            <div class="form-group filter-item" data-field="billing-mode">
              <el-select v-model="filters.billing_mode" placeholder="合同类型" clearable>
                <el-option label="到期买断" value="buyout" />
                <el-option label="按天租赁" value="daily" />
              </el-select>
            </div>
            <div class="form-group filter-item" data-field="status">
              <el-select v-model="filters.status" placeholder="合同状态" clearable>
                <el-option label="进行中" value="active" />
                <el-option label="已归还" value="returned" />
                <el-option label="已逾期" value="overdue" />
                <el-option label="设备损坏" value="damaged" />
              </el-select>
            </div>
          </UnifiedSearchPanel>

          <div class="table-responsive">
            <el-table :data="loading ? [] : rentals" border stripe class="data-table compact-fit-table" :fit="true" row-key="id">
              <template #empty>
                <TableLoadingRow v-if="loading" mode="block" text="加载中..." />
                <el-empty v-else description="暂无租赁合同" />
              </template>
              <el-table-column label="合同编号" min-width="142" align="center"><template #default="{ row }">{{ contractNumber(row) }}</template></el-table-column>
              <el-table-column label="客户" min-width="138" align="center">
                <template #default="{ row }"><div>{{ row.customer_name }}</div><small>{{ row.customer_phone }}</small></template>
              </el-table-column>
              <el-table-column label="租赁设备" min-width="210" align="center" class-name="complete-text-column">
                <template #default="{ row }"><div>{{ deviceName(row) }}</div><small>{{ row.imei || row.serial_number }}</small></template>
              </el-table-column>
              <el-table-column label="销售价格" min-width="96" align="center"><template #default="{ row }">¥{{ formatMoney(row.sale_price) }}</template></el-table-column>
              <el-table-column label="计费" min-width="150" align="center">
                <template #default="{ row }"><el-tag :type="row.billing_mode === 'daily' ? 'primary' : 'success'">{{ row.billing_mode === 'daily' ? `按天 ¥${formatMoney(row.unit_price)}` : `¥${formatMoney(row.installment_amount)}/期` }}</el-tag></template>
              </el-table-column>
              <el-table-column label="租期/还款" min-width="150" align="center">
                <template #default="{ row }">
                  <span v-if="row.billing_mode === 'daily'">已租 {{ row.rented_days }} 天</span>
                  <span v-else>已还 {{ paidPeriods(row) }}/{{ row.term_months }} 期，剩余 {{ row.remaining_periods }} 期<small v-if="row.next_due_date">下次 {{ row.next_due_date }}</small></span>
                </template>
              </el-table-column>
              <el-table-column label="待付租金" min-width="108" align="center"><template #default="{ row }"><strong class="amount-due">¥{{ formatMoney(row.payable_rent) }}</strong></template></el-table-column>
              <el-table-column label="监管锁" min-width="86" align="center"><template #default="{ row }"><el-tag :type="row.monitoring_lock ? 'warning' : 'info'">{{ row.monitoring_lock ? '已安装' : '未安装' }}</el-tag></template></el-table-column>
              <el-table-column label="状态" min-width="82" align="center"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
              <el-table-column label="操作" :width="$getActionColumnWidth(4)" align="center" class-name="actions-column">
                <template #default="{ row }">
                  <div class="action-buttons">
                    <el-button size="small" plain type="primary" class="table-action table-action--view" @click.stop="openDetail(row)">查看</el-button>
                    <el-button v-if="canEdit && row.status === 'active'" size="small" plain type="success" class="table-action table-action--manage" @click.stop="openPayment(row)">还款</el-button>
                    <el-button v-if="canEdit" size="small" plain type="primary" class="table-action table-action--edit" @click.stop="openEdit(row)">编辑</el-button>
                    <el-button v-if="canEdit && row.billing_mode === 'daily' && ['active','overdue'].includes(row.status)" size="small" type="warning" class="table-action table-action--warning" @click.stop="finishRental(row)">归还</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <Pagination v-model:current="pagination.page" v-model:page-size="pagination.size" :total="pagination.total" :page-sizes="[10,20,50,100]" @change="loadRentals" />
        </section>
      </div>

      <MobileDialog v-model="formVisible" :title="editingId ? '编辑租赁合同' : '新建租赁合同'" width="780px" :show-default-footer="false">
        <el-form class="tf-dialog-form rental-form" label-position="top">
          <section class="form-section form-section--customer">
            <div class="form-section-head">
              <span class="form-section-icon"><i class="fas fa-user"></i></span>
              <h4>用户信息</h4>
            </div>
            <el-form-item v-if="!editingId">
              <el-select v-model="form.customer_id" filterable remote clearable :remote-method="searchCustomers" :loading="customerLoading" placeholder="输入姓名或手机号检索" @change="selectCustomer" @clear="resetCustomerSelection">
                <el-option v-for="item in customerOptions" :key="item.id" :value="item.id" :label="`${item.name} ${item.phone}`" />
                <template #empty>
                  <div class="customer-empty">
                    <span>{{ customerKeyword.length >= 2 ? '未检索到对应客户' : '请输入至少2个字或手机号' }}</span>
                    <el-button v-if="customerKeyword.length >= 2" link type="primary" @click.stop="startManualCustomer">新增</el-button>
                  </div>
                </template>
              </el-select>
            </el-form-item>
            <div v-if="!editingId && customerMode !== 'search'" class="customer-editor">
              <div class="customer-editor-head">
                <el-tag :type="customerMode === 'selected' ? 'success' : 'warning'">{{ customerMode === 'selected' ? '客户信息' : '新增客户资料' }}</el-tag>
                <el-button v-if="customerMode === 'selected'" link type="primary" @click="startManualCustomer">新增</el-button>
              </div>
              <div class="form-grid three">
                <el-form-item label="客户姓名"><el-input v-model="customerDraft.name" maxlength="100" /></el-form-item>
                <el-form-item label="手机号码"><el-input v-model="customerDraft.phone" maxlength="11" /></el-form-item>
                <el-form-item label="身份证号"><el-input v-model="customerDraft.id_card" maxlength="18" /></el-form-item>
              </div>
              <el-button plain type="primary" :disabled="customerMode === 'selected' && !customerDirty" :loading="customerSaving" @click="saveCustomerProfile">{{ customerMode === 'selected' ? '保存资料' : '新增客户' }}</el-button>
            </div>
          </section>

          <section class="form-section form-section--device">
            <div class="form-section-head">
              <span class="form-section-icon"><i class="fas fa-mobile-alt"></i></span>
              <h4>设备与合同</h4>
            </div>
            <el-form-item v-if="!editingId">
              <el-select v-if="form.billing_mode === 'daily'" v-model="form.phone_ids" multiple filterable remote :remote-method="searchDevices" :loading="deviceLoading" collapse-tags collapse-tags-tooltip :disabled="Boolean(editingId)" placeholder="检索并选择多台在库设备" @change="syncDailySalePrices">
              <el-option v-for="item in deviceOptions" :key="item.id" :value="item.id" :label="`${deviceName(item)} | ${item.imei || item.serial_number}`" />
              </el-select>
              <el-select v-else v-model="form.phone_id" filterable remote :remote-method="searchDevices" :loading="deviceLoading" :disabled="Boolean(editingId)" placeholder="检索在库设备、IMEI或序列号">
              <el-option v-for="item in deviceOptions" :key="item.id" :value="item.id" :label="`${deviceName(item)} | ${item.imei || item.serial_number}`" />
              </el-select>
            </el-form-item>
            <div v-if="form.billing_mode === 'daily' && selectedDailyDevices.length" class="daily-device-prices">
              <div class="daily-device-price-toolbar">
                <span>设备销售价格</span>
                <div class="daily-device-bulk-price">
                  <el-input-number v-model="bulkDailySalePrice" :min="0" :precision="0" :controls="false" placeholder="统一价格" />
                  <el-button size="small" plain type="primary" :disabled="Number(bulkDailySalePrice) <= 0" @click="applyBulkDailySalePrice">应用到全部</el-button>
                </div>
              </div>
              <div v-for="device in selectedDailyDevices" :key="device.id" class="daily-device-price-row">
                <div class="daily-device-price-info"><strong>{{ deviceName(device) }}</strong><small>{{ device.imei || device.serial_number }}</small></div>
                <el-input-number v-model="dailySalePrices[device.id]" :min="0" :precision="0" :controls="false" placeholder="销售价格" />
              </div>
            </div>
            <div class="form-grid three">
              <div class="contract-mode-row">
                <span class="contract-mode-label">合同类型</span>
                <el-segmented v-model="form.billing_mode" :options="billingOptions" @change="handleBillingModeChange" />
              </div>
              <el-form-item v-if="form.billing_mode !== 'daily'" label="销售价格"><el-input-number v-model="form.sale_price" :min="0" :precision="0" :controls="false" /></el-form-item>
              <el-form-item v-if="form.billing_mode === 'daily'" label="每日租金"><el-input-number v-model="form.unit_price" :min="0" :precision="0" :controls="false" /></el-form-item>
              <el-form-item v-if="form.billing_mode !== 'daily'" label="首付"><el-input-number v-model="form.down_payment" :min="0" :max="form.sale_price" :precision="0" :controls="false" /></el-form-item>
              <el-form-item v-if="form.billing_mode !== 'daily'" label="每月租金"><el-input-number v-model="form.monthly_rent" :min="0" :precision="0" :controls="false" /></el-form-item>
              <el-form-item v-if="form.billing_mode !== 'daily'" label="分期期数"><el-select v-model="form.term_months"><el-option v-for="month in 12" :key="month" :label="`${month}期（${month}个月）`" :value="month" /></el-select></el-form-item>
              <el-form-item v-if="form.billing_mode === 'daily'" label="开始日期"><el-date-picker v-model="form.start_date" type="date" value-format="YYYY-MM-DD" :disabled="Boolean(editingId)" /></el-form-item>
              <el-form-item v-if="form.billing_mode === 'daily'" label="押金"><el-input-number v-model="form.deposit" :min="0" :precision="0" :controls="false" /></el-form-item>
              <el-form-item label="监管锁"><el-switch v-model="form.monitoring_lock" :disabled="form.billing_mode !== 'daily'" inline-prompt active-text="安装" inactive-text="不装" /></el-form-item>
            </div>
            <el-form-item label="合同备注"><el-input v-model="form.remarks" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
          </section>

          <section v-if="form.billing_mode !== 'daily'" class="form-section form-section--sales">
            <div class="form-section-head">
              <span class="form-section-icon"><i class="fas fa-file-invoice-dollar"></i></span>
              <h4>销售信息</h4>
            </div>
            <div class="buyout-summary">
              <div class="buyout-summary-item buyout-summary-item--principal">
                <span>剩余本金</span>
                <strong>¥{{ formatMoney(principalAmount) }}</strong>
              </div>
              <div class="buyout-summary-item buyout-summary-item--period">
                <span>每期本金</span>
                <strong>¥{{ formatMoney(monthlyPrincipal) }}</strong>
              </div>
              <div class="buyout-summary-item buyout-summary-item--receivable">
                <span>每期应收</span>
                <strong>¥{{ formatMoney(installmentAmount) }}</strong>
              </div>
            </div>
            <div class="form-grid three sale-fields">
              <el-form-item label="销售时间"><el-date-picker v-model="form.start_date" type="date" value-format="YYYY-MM-DD" :disabled="Boolean(editingId)" /></el-form-item>
              <el-form-item label="销售店铺"><el-select v-model="form.sale_store_id" filterable clearable placeholder="选择销售店铺"><el-option v-for="store in salesStores" :key="store.id" :label="store.name" :value="store.id" /></el-select></el-form-item>
              <el-form-item label="销售员"><el-select v-model="form.sale_operator_id" filterable placeholder="选择销售员"><el-option v-for="operator in salesOperators" :key="operator.id" :label="operator.name || operator.username" :value="operator.id" /></el-select></el-form-item>
              <el-form-item label="支付方式"><el-select v-model="form.sale_payment_method" placeholder="选择支付方式"><el-option label="现金支付" value="cash" /><el-option label="移动支付" value="mobile" /><el-option label="银行卡" value="bank_card" /><el-option label="国补刷卡" value="subsidy_card" /><el-option label="其他" value="other" /></el-select></el-form-item>
              <el-form-item v-if="['mobile','bank_card','subsidy_card'].includes(form.sale_payment_method)" label="支付渠道"><el-select v-model="form.sale_payment_channel" clearable placeholder="选择支付渠道"><el-option label="微信" value="wechat" /><el-option label="支付宝" value="alipay" /><el-option label="银行转账" value="bank_transfer" /><el-option label="刷卡消费" value="card_consumption" /><el-option label="国补刷卡" value="subsidy_card" /></el-select></el-form-item>
              <el-form-item label="销售备注"><el-input v-model="form.sale_remarks" maxlength="500" /></el-form-item>
            </div>
          </section>
        </el-form>
        <template #footer>
          <div class="tf-dialog-actions"><el-button @click="formVisible=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveRental">保存合同</el-button></div>
        </template>
      </MobileDialog>

      <MobileDialog v-model="detailVisible" title="租赁合同详情" width="860px" :show-default-footer="false">
        <div v-if="selected" class="contract-detail">
          <div class="detail-toolbar">
            <el-button type="primary" @click="printContract(selected)"><i class="fas fa-print"></i>打印合同</el-button>
            <el-upload v-if="canEdit" :show-file-list="false" multiple accept="image/*,.pdf,application/pdf" :http-request="uploadContractFile">
              <el-button type="success"><i class="fas fa-upload"></i>上传签字合同</el-button>
            </el-upload>
          </div>
          <el-descriptions :column="isMobile ? 1 : 2" border>
            <el-descriptions-item label="合同编号">{{ contractNumber(selected) }}</el-descriptions-item>
            <el-descriptions-item label="合同状态">{{ statusLabel(selected.status) }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ selected.customer_name }} {{ selected.customer_phone }}</el-descriptions-item>
            <el-descriptions-item label="身份证">{{ maskIdCard(selected.customer_id_card) }}</el-descriptions-item>
            <el-descriptions-item label="租赁设备">{{ deviceName(selected) }}</el-descriptions-item>
            <el-descriptions-item label="设备识别码">{{ selected.imei || selected.serial_number }}</el-descriptions-item>
            <el-descriptions-item label="合同类型">{{ selected.billing_mode === 'daily' ? `按天租赁 ¥${formatMoney(selected.unit_price)}/天` : `到期买断，共${selected.term_months}期` }}</el-descriptions-item>
            <el-descriptions-item label="销售价格">¥{{ formatMoney(selected.sale_price) }}</el-descriptions-item>
            <el-descriptions-item v-if="selected.billing_mode !== 'daily'" label="买断金额">首付 ¥{{ formatMoney(selected.down_payment) }}，本金 ¥{{ formatMoney(selected.principal_amount) }}</el-descriptions-item>
            <el-descriptions-item v-if="selected.billing_mode !== 'daily'" label="每期应收">本金 ¥{{ formatMoney(selected.monthly_principal) }} + 租金 ¥{{ formatMoney(selected.monthly_rent) }} = ¥{{ formatMoney(selected.installment_amount) }}</el-descriptions-item>
            <el-descriptions-item v-if="selected.sale_order_id" label="销售订单">{{ selected.sale_invoice_number || `#${selected.sale_order_id}` }}</el-descriptions-item>
            <el-descriptions-item v-if="selected.billing_mode !== 'daily'" label="销售店铺">{{ selected.sale_store_name || '-' }}</el-descriptions-item>
            <el-descriptions-item v-if="selected.billing_mode !== 'daily'" label="销售员">{{ selected.sale_operator_name || '-' }}</el-descriptions-item>
            <el-descriptions-item v-if="selected.billing_mode !== 'daily'" label="支付方式">{{ paymentMethodLabel(selected.sale_payment_method) }}{{ selected.sale_payment_channel ? ` / ${selected.sale_payment_channel}` : '' }}</el-descriptions-item>
            <el-descriptions-item v-if="selected.sale_id" label="关联销售订单">#{{ selected.sale_id }}</el-descriptions-item>
            <el-descriptions-item label="监管锁">{{ selected.monitoring_lock ? '安装监管锁' : '不安装监管锁' }}</el-descriptions-item>
            <el-descriptions-item label="租赁时间">{{ selected.start_date }} 至 {{ selected.end_date || '实际归还日' }}</el-descriptions-item>
            <el-descriptions-item label="押金">¥{{ formatMoney(selected.deposit) }}</el-descriptions-item>
            <el-descriptions-item label="已付租金">¥{{ formatMoney(selected.paid_rent) }}</el-descriptions-item>
            <el-descriptions-item label="待付租金">¥{{ formatMoney(selected.payable_rent) }}</el-descriptions-item>
          </el-descriptions>
          <section class="files-section"><h4>签字合同备份</h4><div v-if="selected.contract_files?.length" class="file-grid"><div v-for="file in selected.contract_files" :key="file.id" class="file-item"><a :href="file.file_url" target="_blank">{{ file.file_name || '合同附件' }}</a><el-button v-if="canEdit" link type="danger" @click="deleteContractFile(file)">删除</el-button></div></div><el-empty v-else description="尚未上传签字合同" /></section>
        </div>
        <template #footer><div class="tf-dialog-actions"><el-button @click="detailVisible=false">关闭</el-button></div></template>
      </MobileDialog>

      <MobileDialog v-model="paymentVisible" title="租金还款" width="720px" :show-default-footer="false">
        <div v-if="paymentRental">
          <template v-if="paymentRental.billing_mode !== 'daily'">
            <div class="payment-summary">每期月供 ¥{{ formatMoney(paymentRental.unit_price) }}，已还 {{ paidScheduleCount }}/{{ paymentRental.term_months }} 期</div>
            <el-checkbox-group v-model="selectedPeriods" class="period-grid">
              <el-checkbox v-for="period in paymentSchedule" :key="period.period_number" :value="period.period_number" :disabled="period.paid" border>
                <span>第{{ period.period_number }}期<small>{{ period.due_date }} · ¥{{ formatMoney(period.amount) }}</small></span><span>{{ period.paid ? '已还' : '未还' }}</span>
              </el-checkbox>
            </el-checkbox-group>
            <div class="payment-total">本次选择 {{ selectedPeriods.length }} 期，应收 ¥{{ formatMoney(selectedPaymentTotal) }}</div>
          </template>
          <el-form-item v-else label="本次收款"><el-input-number v-model="dailyPaymentAmount" :min="0" :precision="0" :controls="false" /></el-form-item>
          <el-form-item label="收款备注"><el-input v-model="paymentRemarks" /></el-form-item>
        </div>
        <template #footer><div class="tf-dialog-actions"><el-button @click="paymentVisible=false">取消</el-button><el-button type="success" :loading="paymentSaving" @click="savePayment">{{ paymentRental?.billing_mode === 'daily' ? '确认收租' : '确认月供' }}</el-button></div></template>
      </MobileDialog>
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type UploadRequestOptions } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import { useMobile } from '@/composables/mobile'
import { PageHeader, PermissionGate } from '@/components/base'
import MobileDialog from '@/components/MobileDialog.vue'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'

type BillingMode = 'daily' | 'buyout'
interface Customer { id:number; name:string; phone:string; id_card?:string }
interface Device { id:number; imei?:string; serial_number?:string; brand?:string; model?:string; color?:string; memory?:string }
interface ContractFile { id:number; file_url:string; file_name?:string }
interface Rental extends Device { id:number; contract_number?:string; phone_id:number; customer_id:number; customer_name:string; customer_phone:string; customer_id_card?:string; billing_mode:BillingMode; unit_price:number; term_months?:number; sale_price?:number; sale_order_price?:number; down_payment?:number; principal_amount?:number; monthly_rent?:number; monthly_principal?:number; installment_amount?:number; monitoring_lock:number; start_date:string; end_date?:string; returned_at?:string; deposit:number; total_cost:number; status:string; sale_id?:number; sale_order_id?:number; sale_invoice_number?:string; sale_store_id?:number; sale_store_name?:string; sale_operator_id?:number; sale_operator_name?:string; sale_payment_method?:string; sale_payment_channel?:string; sale_remarks?:string; remarks?:string; rented_days:number; accrued_rent:number; paid_rent:number; payable_rent:number; remaining_periods?:number; next_due_date?:string; paid_period_numbers?:number[]; contract_files?:ContractFile[] }
interface ScheduleItem { period_number:number; due_date:string; amount:number; principal_amount?:number; monthly_rent?:number; paid:boolean; paid_at?:string }

const { canView, canCreate, canEdit, handleNoPermission } = usePagePermissions('rentals')
const { loading } = useLoadingState()
const { isMobile } = useMobile()
const rentals = ref<Rental[]>([])
const searchExpanded = ref(false)
const filters = reactive({ keyword:'', billing_mode:'', status:'' })
const pagination = reactive({ page:1, size:20, total:0 })
const formVisible = ref(false)
const detailVisible = ref(false)
const paymentVisible = ref(false)
const editingId = ref<number|null>(null)
const selected = ref<Rental|null>(null)
const saving = ref(false)
const customerLoading = ref(false)
const customerSaving = ref(false)
const deviceLoading = ref(false)
const customerOptions = ref<Customer[]>([])
const deviceOptions = ref<Device[]>([])
const salesOperators = ref<{ id:number; name?:string; username?:string }[]>([])
const salesStores = ref<{ id:number; name:string }[]>([])
const customerKeyword = ref('')
const customerMode = ref<'search'|'selected'|'manual'>('search')
const customerDraft = reactive({ name:'', phone:'', id_card:'' })
const customerOriginal = reactive({ name:'', phone:'', id_card:'' })
const dailySalePrices = reactive<Record<number, number|null>>({})
const bulkDailySalePrice = ref<number|null>(null)
const form = reactive({ customer_id:null as number|null, phone_id:null as number|null, phone_ids:[] as number[], billing_mode:'buyout' as BillingMode, unit_price:null as number|null, term_months:1, sale_price:null as number|null, down_payment:null as number|null, monthly_rent:null as number|null, sale_store_id:null as number|null, sale_operator_id:null as number|null, sale_payment_method:'cash', sale_payment_channel:'', sale_remarks:'', monitoring_lock:true, start_date:new Date().toISOString().slice(0,10), deposit:null as number|null, remarks:'' })
const billingOptions = [{ label:'到期买断', value:'buyout' }, { label:'按天租赁', value:'daily' }]
const paymentRental = ref<Rental|null>(null)
const paymentSchedule = ref<ScheduleItem[]>([])
const selectedPeriods = ref<number[]>([])
const dailyPaymentAmount = ref(0)
const paymentRemarks = ref('')
const paymentSaving = ref(false)

const summary = computed(() => {
  const active = rentals.value.filter(item => ['active','overdue'].includes(item.status))
  return { active:active.length, devices:active.length, receivable:active.reduce((s,i)=>s+Number(i.payable_rent||0),0), deposits:active.reduce((s,i)=>s+Number(i.deposit||0),0) }
})
const paidScheduleCount = computed(() => paymentSchedule.value.filter(item => item.paid).length)
const selectedPaymentTotal = computed(() => paymentSchedule.value.filter(item => selectedPeriods.value.includes(item.period_number)).reduce((sum, item) => sum + Number(item.amount || 0), 0))
const paidPeriods = (row:Rental) => Math.max(Number(row.term_months||0)-Number(row.remaining_periods||0),0)
const formatMoney = (value:unknown) => Number(value||0).toFixed(2).replace(/\.00$/,'')
const deviceName = (row:Partial<Device>) => [row.brand,row.model,row.color,row.memory].filter(Boolean).join(' ') || '未命名设备'
const contractNumber = (row:Partial<Rental>) => row.contract_number || `${row.billing_mode === 'daily' ? 'ZL' : 'MD'}${String(row.start_date || '').replace(/-/g,'').slice(0,8)}${String(row.id || '').padStart(4,'0')}`
const statusLabel = (status:string) => ({active:'进行中',returned:'已归还',overdue:'已逾期',damaged:'设备损坏',bought_out:'已买断'}[status] || status)
const statusType = (status:string):'success'|'info'|'warning'|'danger' => ({active:'success',returned:'info',overdue:'warning',damaged:'danger',bought_out:'success'}[status] as any || 'info')
const maskIdCard = (value?:string) => value ? `${value.slice(0,6)}********${value.slice(-4)}` : '-'
const paymentMethodLabel = (value?:string) => ({cash:'现金支付',mobile:'移动支付',bank_card:'银行卡',subsidy_card:'国补刷卡',transfer:'银行转账',other:'其他'}[value || ''] || value || '-')
const principalAmount = computed(() => Math.max(Number(form.sale_price || 0) - Number(form.down_payment || 0), 0))
const monthlyPrincipal = computed(() => form.term_months ? principalAmount.value / Number(form.term_months) : 0)
const installmentAmount = computed(() => monthlyPrincipal.value + Number(form.monthly_rent || 0))
const customerDirty = computed(() => customerMode.value !== 'selected' || customerDraft.name !== customerOriginal.name || customerDraft.phone !== customerOriginal.phone || customerDraft.id_card !== customerOriginal.id_card)
const selectedDailyDevices = computed(() => form.phone_ids.map(id => deviceOptions.value.find(item => item.id === id)).filter((item): item is Device => Boolean(item)))

async function loadRentals(){ if(!canView.value)return; loading.value=true; try{const res=await unifiedApi.get('/rentals',{params:{page:pagination.page,limit:pagination.size,...filters},useCache:false}); rentals.value=Array.isArray(res.data)?res.data:[]; pagination.total=Number((res as any).pagination?.total||rentals.value.length)}finally{loading.value=false} }
function handleSearch(){pagination.page=1;loadRentals()}
function resetSearch(){Object.assign(filters,{keyword:'',billing_mode:'',status:''});handleSearch()}
function resetForm(){editingId.value=null;Object.keys(dailySalePrices).forEach(key=>delete dailySalePrices[Number(key)]);bulkDailySalePrice.value=null;Object.assign(form,{customer_id:null,phone_id:null,phone_ids:[],billing_mode:'buyout',unit_price:null,term_months:1,sale_price:null,down_payment:null,monthly_rent:null,sale_store_id:null,sale_operator_id:defaultSaleOperatorId(),sale_payment_method:'cash',sale_payment_channel:'',sale_remarks:'',monitoring_lock:true,start_date:new Date().toISOString().slice(0,10),deposit:null,remarks:''});Object.assign(customerDraft,{name:'',phone:'',id_card:''});Object.assign(customerOriginal,{name:'',phone:'',id_card:''});customerKeyword.value='';customerMode.value='search';customerOptions.value=[];deviceOptions.value=[]}
function defaultSaleOperatorId(){return salesOperators.value[0]?.id || null}
async function loadSalesOptions(){try{const res=await unifiedApi.get('/rentals/sales-options',{useCache:false});const data=(res.data||{}) as any;salesOperators.value=Array.isArray(data.operators)?data.operators:[];salesStores.value=Array.isArray(data.stores)?data.stores:[];if(!form.sale_operator_id)form.sale_operator_id=defaultSaleOperatorId()}catch(error){console.warn('加载销售选项失败',error)}}
function openCreateDialog(){if(!canCreate.value)return handleNoPermission('create');resetForm();formVisible.value=true;searchDevices('');loadSalesOptions()}
function openEdit(row:Rental){if(!canEdit.value)return handleNoPermission('edit');editingId.value=row.id;Object.assign(form,{customer_id:row.customer_id,phone_id:row.phone_id,phone_ids:[row.phone_id],billing_mode:row.billing_mode==='daily'?'daily':'buyout',unit_price:Number(row.unit_price),term_months:Number(row.term_months||1),sale_price:Number(row.sale_price||row.sale_order_price||0),down_payment:Number(row.down_payment||0),monthly_rent:Number(row.monthly_rent||0),sale_store_id:row.sale_store_id||null,sale_operator_id:row.sale_operator_id||null,sale_payment_method:row.sale_payment_method||'cash',sale_payment_channel:'',sale_remarks:row.sale_remarks||'',monitoring_lock:row.billing_mode==='daily'?Boolean(row.monitoring_lock):true,start_date:row.start_date,deposit:row.billing_mode==='daily'?Number(row.deposit||0):null,remarks:row.remarks||''});formVisible.value=true;loadSalesOptions()}
function openDetail(row:Rental){selected.value={...row};detailVisible.value=true}
async function searchCustomers(keyword:string){customerKeyword.value=keyword.trim();customerMode.value='search';form.customer_id=null;if(customerKeyword.value.length<2){customerOptions.value=[];return}customerLoading.value=true;try{const res=await unifiedApi.get('/rentals/customers',{params:{keyword:customerKeyword.value}});customerOptions.value=Array.isArray(res.data)?res.data:[]}finally{customerLoading.value=false}}
function selectCustomer(id:number|null){const item=customerOptions.value.find(c=>c.id===id);if(!item)return resetCustomerSelection();customerMode.value='selected';Object.assign(customerDraft,{name:item.name,phone:item.phone,id_card:item.id_card||''});Object.assign(customerOriginal,customerDraft)}
function resetCustomerSelection(){form.customer_id=null;customerMode.value='search';Object.assign(customerDraft,{name:'',phone:'',id_card:''});Object.assign(customerOriginal,{name:'',phone:'',id_card:''})}
function startManualCustomer(){const keyword=customerKeyword.value;form.customer_id=null;customerMode.value='manual';Object.assign(customerDraft,{name:/^1[3-9]\d{9}$/.test(keyword)?'':keyword,phone:/^1[3-9]\d{9}$/.test(keyword)?keyword:'',id_card:''});Object.assign(customerOriginal,{name:'',phone:'',id_card:''})}
async function persistCustomer(){if(customerMode.value==='search')throw new Error('请先检索并选择客户，或手动新增客户');if(form.customer_id&&!customerDirty.value)return form.customer_id;customerSaving.value=true;try{const res=form.customer_id?await unifiedApi.put(`/rentals/customers/${form.customer_id}`,customerDraft):await unifiedApi.post('/rentals/customers',customerDraft);const item=res.data as Customer;form.customer_id=item.id;customerOptions.value=[item];customerMode.value='selected';Object.assign(customerDraft,item);Object.assign(customerOriginal,customerDraft);return item.id}finally{customerSaving.value=false}}
async function saveCustomerProfile(){try{await persistCustomer();ElMessage.success('客户资料已保存并选择')}catch(error){ElMessage.error(error instanceof Error?error.message:'客户资料保存失败')}}
async function searchDevices(keyword:string){deviceLoading.value=true;try{const res=await unifiedApi.get('/rentals/devices',{params:{keyword:keyword.trim()}});const rows=Array.isArray(res.data)?res.data:[];const selectedIds=new Set([...(form.phone_ids||[]),form.phone_id].filter((id):id is number=>Boolean(id)));const selectedOptions=deviceOptions.value.filter(item=>selectedIds.has(item.id));deviceOptions.value=[...rows,...selectedOptions.filter(item=>!rows.some(row=>row.id===item.id))]}finally{deviceLoading.value=false}}
function handleBillingModeChange(mode:BillingMode){if(mode==='buyout'){form.deposit=0;form.monitoring_lock=true;if(!form.phone_id&&form.phone_ids.length)form.phone_id=form.phone_ids[0]}else if(form.phone_id&&!form.phone_ids.length){form.phone_ids=[form.phone_id]}}
function syncDailySalePrices(ids:number[]){ids.forEach(id=>{if(!(id in dailySalePrices))dailySalePrices[id]=null});Object.keys(dailySalePrices).forEach(key=>{if(!ids.includes(Number(key)))delete dailySalePrices[Number(key)]})}
function applyBulkDailySalePrice(){if(Number(bulkDailySalePrice.value)<=0)return;form.phone_ids.forEach(id=>{dailySalePrices[id]=Number(bulkDailySalePrice.value)})}
async function saveRental(){const phoneIds=editingId.value?[form.phone_id].filter((id):id is number=>Boolean(id)):form.billing_mode==='daily'?form.phone_ids:[form.phone_id].filter((id):id is number=>Boolean(id));if(!phoneIds.length)return ElMessage.warning('请选择在库设备');if(form.billing_mode==='daily'&&Number(form.unit_price)<=0)return ElMessage.warning('请输入每日租金');if(form.billing_mode==='daily'&&phoneIds.some(id=>Number(dailySalePrices[id])<=0))return ElMessage.warning('请为每台设备填写销售价格');if(form.billing_mode!=='daily'){if(Number(form.sale_price)<=0)return ElMessage.warning('请输入销售价格');if(Number(form.down_payment)<0||Number(form.down_payment)>Number(form.sale_price))return ElMessage.warning('首付不能大于销售总价');if(Number(form.monthly_rent)<0)return ElMessage.warning('每月租金不能小于0');if(!form.sale_operator_id)return ElMessage.warning('请选择销售员');if(!form.sale_store_id)return ElMessage.warning('请选择销售店铺');if(!form.sale_payment_method)return ElMessage.warning('请选择支付方式');form.deposit=0;form.monitoring_lock=true} saving.value=true;try{if(!editingId.value)await persistCustomer();if(editingId.value)await unifiedApi.put(`/rentals/${editingId.value}`,{...form,phone_id:phoneIds[0],sale_price:form.billing_mode==='daily'?dailySalePrices[phoneIds[0]]:form.sale_price});else for(const phoneId of phoneIds)await unifiedApi.post('/rentals',{...form,phone_id:phoneId,phone_ids:undefined,sale_price:form.billing_mode==='daily'?dailySalePrices[phoneId]:form.sale_price,unit_price:form.billing_mode==='daily'?form.unit_price:0,deposit:form.billing_mode==='daily'?form.deposit:0,monitoring_lock:form.billing_mode==='daily'?form.monitoring_lock:true});ElMessage.success(editingId.value?'合同已保存':form.billing_mode==='daily'?`已创建${phoneIds.length}份按天租赁合同`:'买断合同及销售订单已创建');formVisible.value=false;await loadRentals()}catch(error){ElMessage.error(error instanceof Error?error.message:'合同保存失败')}finally{saving.value=false}}
async function finishRental(row:Rental){await ElMessageBox.confirm(`确认设备已归还？合同 ${contractNumber(row)} 将结束，设备恢复为可售。`,'归还设备',{type:'warning'});await unifiedApi.post(`/rentals/${row.id}/finish`);ElMessage.success('设备已归还并恢复可售');await loadRentals()}
async function openPayment(row:Rental){paymentRental.value=row;selectedPeriods.value=[];dailyPaymentAmount.value=Number(row.payable_rent||0);paymentRemarks.value='';const res=await unifiedApi.get(`/rentals/${row.id}/payment-schedule`);paymentSchedule.value=(res.data as any)?.schedule||[];paymentVisible.value=true}
async function savePayment(){if(!paymentRental.value)return;if(paymentRental.value.billing_mode!=='daily'&&!selectedPeriods.value.length)return ElMessage.warning('请选择月供期次');paymentSaving.value=true;try{await unifiedApi.post(`/rentals/${paymentRental.value.id}/payments`,paymentRental.value.billing_mode!=='daily'?{period_numbers:selectedPeriods.value,remarks:paymentRemarks.value}:{amount:dailyPaymentAmount.value,remarks:paymentRemarks.value});ElMessage.success(paymentRental.value.billing_mode==='daily'?'租金已登记':'月供已登记，销售订单收款已同步');paymentVisible.value=false;await loadRentals()}finally{paymentSaving.value=false}}
async function uploadContractFile(options:UploadRequestOptions){if(!selected.value)return;const data=new FormData();data.append('files',options.file);try{await unifiedApi.upload(`/rentals/${selected.value.id}/files`,data);options.onSuccess?.({});ElMessage.success('签字合同已上传');await loadRentals();selected.value=rentals.value.find(i=>i.id===selected.value?.id)||selected.value}catch(error){ElMessage.error(error instanceof Error?error.message:'合同上传失败')}}
async function deleteContractFile(file:ContractFile){if(!selected.value)return;await ElMessageBox.confirm('删除这份合同备份？','删除确认',{type:'warning'});await unifiedApi.delete(`/rentals/${selected.value.id}/files/${file.id}`);selected.value.contract_files=selected.value.contract_files?.filter(i=>i.id!==file.id)}
function printContract(row:Rental){const win=window.open('','_blank','width=900,height=900');if(!win)return ElMessage.error('浏览器阻止了打印窗口');const lockText=row.monitoring_lock?'承租方同意安装监管锁，合同结束并结清款项后由出租方解除。':'本合同设备不安装监管锁，承租方仍承担妥善保管与按期付款义务。';const modeText=row.billing_mode==='daily'?`按天租赁 ¥${formatMoney(row.unit_price)}/天，设备归还后结算`:`到期买断：销售总价 ¥${formatMoney(row.sale_price)}，首付 ¥${formatMoney(row.down_payment)}，剩余本金 ¥${formatMoney(row.principal_amount)}，${row.term_months}期，每期本金 ¥${formatMoney(row.monthly_principal)} + 月租 ¥${formatMoney(row.monthly_rent)} = ¥${formatMoney(row.installment_amount)}`;win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>租赁合同 R${row.id}</title><style>body{font-family:Arial,"Microsoft YaHei",sans-serif;color:#111;padding:32px;line-height:1.7}h1{text-align:center;font-size:24px}table{width:100%;border-collapse:collapse;margin:20px 0}td{border:1px solid #555;padding:8px}.term{margin:12px 0}.sign{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:60px}.line{border-bottom:1px solid #333;height:40px}@media print{button{display:none}}</style></head><body><h1>设备租赁合同</h1><table><tr><td>合同编号</td><td>R${row.id}</td><td>签订日期</td><td>${row.start_date}</td></tr><tr><td>承租方</td><td>${row.customer_name}</td><td>联系电话</td><td>${row.customer_phone}</td></tr><tr><td>身份证号</td><td colspan="3">${row.customer_id_card||''}</td></tr><tr><td>租赁设备</td><td colspan="3">${deviceName(row)} / ${row.imei||row.serial_number||''}</td></tr><tr><td>合同类型</td><td colspan="3">${modeText}</td></tr><tr><td>销售订单</td><td>${row.sale_invoice_number||'-'}</td><td>销售店铺</td><td>${row.sale_store_name||'-'}</td></tr><tr><td>销售员</td><td>${row.sale_operator_name||'-'}</td><td>支付方式</td><td>${paymentMethodLabel(row.sale_payment_method)}</td></tr><tr><td>押金</td><td>¥${formatMoney(row.deposit)}</td><td>监管锁</td><td>${row.monitoring_lock?'安装监管锁':'不安装监管锁'}</td></tr><tr><td>合同期限</td><td colspan="3">${row.start_date} 至 ${row.end_date||'实际归还日'}</td></tr></table><div class="term">1. 承租方确认设备外观、功能及识别码无误，应妥善保管，不得擅自拆机、转租、抵押或用于违法用途。</div><div class="term">2. ${lockText}</div><div class="term">3. 到期买断合同创建时已同步生成销售订单，设备归属客户；按天租赁以实际占用自然日计费，归还并结清后合同结束。</div><div class="term">4. 设备损坏、遗失或无法正常归还时，由双方按检测结果及实际价值协商赔偿；押金可优先用于抵扣。</div><div class="term">5. 合同结束须完成设备验收、租金结清和押金处理。双方签字后生效，签字合同影像与纸质合同具有对应关系。</div><div class="sign"><div>出租方签字：<div class="line"></div></div><div>承租方签字：<div class="line"></div></div></div><script>window.onload=()=>window.print()<\/script></body></html>`);win.document.close()}
onMounted(loadRentals)
</script>

<style scoped>
.rentals-view{padding:20px}.rentals-content{display:flex;flex-direction:column;gap:16px}.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.stat-card{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border:1px solid var(--el-border-color-lighter);border-radius:6px;background:#fff}.stat-card strong{font-size:20px}.stat-card span,small{color:var(--el-text-color-secondary)}.panel-heading{display:flex;align-items:center;justify-content:space-between;padding:14px 16px}.panel-heading h3,.form-section h4,.files-section h4{margin:0}.amount-due{color:var(--el-color-danger)}.form-section{padding:14px 0;border-bottom:1px solid var(--el-border-color-lighter)}.form-section:last-child{border-bottom:0}.form-section h4{margin-bottom:12px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}.form-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.rental-form :deep(.el-select),.rental-form :deep(.el-input-number),.rental-form :deep(.el-date-editor){width:100%}.rental-form :deep(.el-input-number.is-disabled){width:100%}.field-hint{display:block;margin-top:4px;font-size:12px}.customer-empty{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;color:var(--el-text-color-secondary)}.customer-editor{margin-top:10px;padding:10px 12px;background:var(--el-fill-color-light);border-radius:6px}.customer-editor-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.buyout-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}.buyout-summary-item{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;padding:10px 12px;border:1px solid;border-radius:6px}.buyout-summary-item span{font-size:12px;white-space:nowrap}.buyout-summary-item strong{font-size:16px;white-space:nowrap}.buyout-summary-item--principal{background:var(--tf-button-primary-soft-bg);border-color:var(--tf-button-primary-soft-border);color:var(--tf-button-primary-soft-color)}.buyout-summary-item--period{background:var(--tf-button-success-soft-bg);border-color:var(--tf-button-success-soft-border);color:var(--tf-button-success-soft-color)}.buyout-summary-item--receivable{background:var(--tf-button-warning-soft-bg);border-color:var(--tf-button-warning-soft-border);color:var(--tf-button-warning-soft-color)}.detail-toolbar{display:flex;gap:10px;justify-content:flex-end;margin-bottom:14px}.files-section{margin-top:18px}.file-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.file-item{display:flex;align-items:center;justify-content:space-between;min-width:0;padding:8px 10px;border:1px solid var(--el-border-color);border-radius:6px}.file-item a{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.payment-summary,.payment-total{padding:12px;background:var(--el-fill-color-light);border-radius:6px;margin-bottom:12px}.payment-total{margin-top:12px;font-weight:700}.period-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.period-grid :deep(.el-checkbox){width:100%;margin:0}.period-grid :deep(.el-checkbox__label){display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%}.period-grid :deep(.el-checkbox__label>span:first-child){display:flex;flex-direction:column}.period-grid small{font-size:11px}@media(max-width:768px){.rentals-view{padding:8px}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.form-grid,.form-grid.three{grid-template-columns:1fr}.buyout-summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.buyout-summary-item{align-items:flex-start;flex-direction:column;gap:2px;padding:8px}.buyout-summary-item strong{font-size:14px}.file-grid{grid-template-columns:1fr}.period-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.detail-toolbar{justify-content:stretch}.detail-toolbar :deep(.el-button){flex:1}.action-buttons{flex-wrap:nowrap}}@media(max-width:390px){.buyout-summary{grid-template-columns:1fr}.buyout-summary-item{align-items:center;flex-direction:row}}
 .form-section{padding:16px;border:1px solid var(--el-border-color-lighter);border-radius:8px;background:var(--el-bg-color);margin-bottom:12px}
.form-section-head{display:flex;align-items:center;gap:9px;margin-bottom:14px;min-height:28px}
.form-section-head h4{margin:0;font-size:15px;font-weight:650;color:var(--el-text-color-primary)}
.form-section-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 28px;border-radius:7px;font-size:13px}
.form-section--customer .form-section-icon{background:var(--tf-button-primary-soft-bg);color:var(--tf-button-primary-soft-color)}
.form-section--device .form-section-icon{background:var(--tf-button-success-soft-bg);color:var(--tf-button-success-soft-color)}
.form-section--sales .form-section-icon{background:var(--tf-button-warning-soft-bg);color:var(--tf-button-warning-soft-color)}
.contract-mode-row{grid-column:1/-1;display:flex;align-items:center;gap:12px;min-width:0;margin-bottom:14px}.contract-mode-label{flex:0 0 auto;font-size:14px;font-weight:600;color:var(--el-text-color-regular);white-space:nowrap}.contract-mode-row :deep(.el-segmented){flex:1;min-width:0}.contract-mode-row :deep(.el-segmented__group){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%}.contract-mode-row :deep(.el-segmented__item){justify-content:center;min-width:0}
@media(max-width:768px){.form-section{padding:12px;border-radius:7px}.form-section-head{margin-bottom:12px}.contract-mode-row{gap:8px}.contract-mode-label{font-size:13px}.contract-mode-row :deep(.el-segmented__item-label){padding-inline:6px;white-space:nowrap}}
.daily-device-prices{display:flex;flex-direction:column;gap:6px;margin:0 0 14px;padding:8px;border:1px solid var(--el-border-color-lighter);border-radius:6px;background:var(--el-fill-color-lighter)}.daily-device-price-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 2px 6px;color:var(--el-text-color-regular);font-size:13px;font-weight:600}.daily-device-bulk-price{display:flex;align-items:center;gap:6px}.daily-device-bulk-price :deep(.el-input-number){width:120px}.daily-device-price-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding:8px 10px;background:var(--el-bg-color);border:1px solid var(--el-border-color-lighter);border-radius:5px}.daily-device-price-info{display:flex;flex-direction:column;gap:2px;min-width:0}.daily-device-price-info strong,.daily-device-price-info small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.daily-device-price-row :deep(.el-input-number){width:150px;flex:0 0 150px}.daily-device-price-row :deep(.el-input__inner){text-align:right}@media(max-width:480px){.daily-device-price-toolbar{align-items:stretch;flex-direction:column;gap:6px}.daily-device-bulk-price :deep(.el-input-number){flex:1;width:auto}.daily-device-bulk-price :deep(.el-button){flex:0 0 auto}.daily-device-price-row{gap:8px;padding:7px 8px}.daily-device-price-row :deep(.el-input-number){width:112px;flex-basis:112px}.daily-device-price-info strong{font-size:13px}.daily-device-price-info small{font-size:11px}}
</style>
