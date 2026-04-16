<template>
  <section class="form-section wholesale-party-section">
    <template v-if="mode === 'wholesale'">
      <h4 class="section-title">
        <i class="fas fa-user"></i>
        客户信息
      </h4>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="手机号码" prop="customer_phone" required class="customer-search-form-item">
            <el-input
              v-model="formData.customer_phone"
              placeholder="请输入手机号码"
              clearable
              maxlength="11"
              @input="handlePhoneInput"
              @focus="handlePhoneFocus"
              @blur="handlePhoneBlur"
            >
              <template #prefix>
                <i class="fas fa-mobile-alt"></i>
              </template>
            </el-input>

            <div
              v-if="showCustomerSearch && (customerSearchResults.length > 0 || customerSearching || (formData.customer_phone.length >= 11 && !selectedCustomer && !customerSearching))"
              class="customer-search-results"
            >
              <div v-if="customerSearching" class="searching">
                <i class="fas fa-spinner fa-spin"></i>
                搜索中...
              </div>
              <div v-else-if="customerSearchResults.length > 0" class="results-list">
                <div
                  v-for="customer in customerSearchResults"
                  :key="customer.id"
                  class="customer-item"
                  @click="selectCustomer(customer)"
                >
                  <div class="customer-info">
                    <span class="customer-name">{{ customer.name }}</span>
                    <span class="customer-phone">{{ customer.phone }}</span>
                  </div>
                  <i class="fas fa-check-circle"></i>
                </div>
              </div>
              <div
                v-else-if="formData.customer_phone.length >= 11 && !selectedCustomer && !customerSearching"
                class="create-new-customer"
                @click="autoCreateCustomer"
              >
                <i class="fas fa-plus-circle"></i>
                自动创建新客户
              </div>
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="客户姓名" prop="customer_name" required>
            <el-input
              v-model="formData.customer_name"
              placeholder="客户姓名"
              clearable
              @input="handleCustomerNameInput"
            >
              <template #prefix>
                <i class="fas fa-user"></i>
              </template>
            </el-input>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="销售时间" prop="sale_date" required>
            <el-date-picker
              v-model="formData.sale_date"
              type="date"
              placeholder="选择销售时间"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              class="w-full"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="销售员">
            <el-select
              v-model="formData.salesperson_name"
              placeholder="选择销售员"
              filterable
              allow-create
              clearable
              class="w-full"
            >
              <el-option
                v-for="user in users"
                :key="user.id"
                :label="user.name"
                :value="user.name"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="销售门店" prop="store_id">
            <el-select
              v-model="formData.store_id"
              placeholder="请选择销售门店"
              clearable
              class="w-full"
            >
              <el-option
                v-for="store in stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="12">
        <el-col :span="8">
          <el-form-item label="支付方式" prop="payment_method">
            <el-select
              v-model="formData.payment_method"
              placeholder="请选择"
              clearable
              class="w-full"
              @change="handlePaymentMethodChange"
            >
              <el-option label="现金支付" value="cash" />
              <el-option label="移动支付" value="mobile" />
              <el-option label="银行卡" value="bank_card" />
              <el-option label="国补刷卡" value="subsidy_card" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item
            v-if="formData.payment_method === 'mobile' || formData.payment_method === 'bank_card' || formData.payment_method === 'subsidy_card'"
            label="支付渠道"
            prop="payment_channel"
          >
            <el-select
              v-model="formData.payment_channel"
              placeholder="请选择"
              clearable
              class="w-full"
              @change="handlePaymentChannelChange"
            >
              <template v-if="formData.payment_method === 'mobile'">
                <el-option label="微信" value="wechat" />
                <el-option label="支付宝" value="alipay" />
              </template>
              <template v-if="formData.payment_method === 'bank_card'">
                <el-option label="刷卡消费" value="card_consumption" />
                <el-option label="银行转账" value="bank_transfer" />
              </template>
              <template v-if="formData.payment_method === 'subsidy_card'">
                <el-option label="国补刷卡" value="subsidy_card" />
              </template>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="发票号" prop="invoice_number">
            <el-input
              v-model="formData.invoice_number"
              placeholder="请输入发票号（可选）"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
    </template>

    <template v-else>
      <h4 class="section-title">
        <i class="fas fa-truck"></i>
        供应商信息
      </h4>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="供应商" prop="supplier_id" required>
            <el-input
              :value="selectedSupplierName"
              placeholder="供应商"
              readonly
              class="w-full"
            >
              <template #prefix>
                <i class="fas fa-truck"></i>
              </template>
            </el-input>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="销售门店" prop="store_id">
            <el-select
              v-model="formData.store_id"
              placeholder="选择销售门店"
              clearable
              class="w-full"
            >
              <el-option
                v-for="store in stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="划拨时间" prop="sale_date" required>
            <el-date-picker
              v-model="formData.sale_date"
              type="date"
              placeholder="选择划拨时间"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              class="w-full"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="销售员">
            <el-select
              v-model="formData.salesperson_name"
              placeholder="选择销售员"
              filterable
              allow-create
              clearable
              class="w-full"
            >
              <el-option
                v-for="user in users"
                :key="user.id"
                :label="user.name"
                :value="user.name"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="客户手机" prop="customer_phone" class="customer-search-form-item">
            <el-input
              v-model="formData.customer_phone"
              placeholder="客户手机号（可选）"
              clearable
              maxlength="11"
              @input="handlePhoneInput"
              @focus="handlePhoneFocus"
              @blur="handlePhoneBlur"
            >
              <template #prefix>
                <i class="fas fa-mobile-alt"></i>
              </template>
            </el-input>

            <div
              v-if="showCustomerSearch && (customerSearchResults.length > 0 || customerSearching || (formData.customer_phone.length >= 11 && !selectedCustomer && !customerSearching))"
              class="customer-search-results"
            >
              <div v-if="customerSearching" class="searching">
                <i class="fas fa-spinner fa-spin"></i>
                搜索中...
              </div>
              <div v-else-if="customerSearchResults.length > 0" class="results-list">
                <div
                  v-for="customer in customerSearchResults"
                  :key="customer.id"
                  class="customer-item"
                  @click="selectCustomer(customer)"
                >
                  <div class="customer-info">
                    <span class="customer-name">{{ customer.name }}</span>
                    <span class="customer-phone">{{ customer.phone }}</span>
                  </div>
                  <i class="fas fa-check-circle"></i>
                </div>
              </div>
              <div
                v-else-if="formData.customer_phone.length >= 11 && !selectedCustomer && !customerSearching"
                class="create-new-customer"
                @click="autoCreateCustomer"
              >
                <i class="fas fa-plus-circle"></i>
                自动创建新客户
              </div>
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="客户姓名" prop="customer_name">
            <el-input
              v-model="formData.customer_name"
              placeholder="客户姓名（可选）"
              clearable
              @input="handleCustomerNameInput"
            >
              <template #prefix>
                <i class="fas fa-user"></i>
              </template>
            </el-input>
          </el-form-item>
        </el-col>
      </el-row>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { Store, User } from '@/types'
import type { WholesaleCustomerSearchItem, WholesaleFormData } from './types'

interface Props {
  mode: 'wholesale' | 'proxy'
  formData: WholesaleFormData
  stores: Store[]
  users: User[]
  selectedSupplierName: string
  showCustomerSearch: boolean
  customerSearchResults: WholesaleCustomerSearchItem[]
  customerSearching: boolean
  selectedCustomer: WholesaleCustomerSearchItem | null
  handlePhoneInput: (value: string) => void
  handlePhoneFocus: () => void
  handlePhoneBlur: () => void
  handleCustomerNameInput: (value: string) => void
  selectCustomer: (customer: WholesaleCustomerSearchItem) => void
  autoCreateCustomer: () => void | Promise<void>
  handlePaymentMethodChange: () => void
  handlePaymentChannelChange: () => void
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
.form-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #f0f2f5;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
}

.section-title i {
  font-size: 16px;
}

.customer-search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.searching {
  padding: 12px 16px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.searching i {
  margin-right: 6px;
}

.customer-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.customer-item:hover {
  background: #f5f7fa;
}

.customer-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.customer-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.customer-phone {
  font-size: 12px;
  color: #909399;
}

.customer-item i {
  color: #67c23a;
  font-size: 16px;
}

.create-new-customer {
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s;
  color: #409eff;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.create-new-customer:hover {
  background: #ecf5ff;
}

:deep(.customer-search-form-item) .el-form-item__content {
  position: relative !important;
}

@media (max-width: 767px) {
  .form-section {
    margin-bottom: 20px;
    padding-bottom: 20px;
  }

  :deep(.el-row) {
    display: flex;
    flex-wrap: wrap;
    margin-left: -6px !important;
    margin-right: -6px !important;
  }

  :deep(.el-col) {
    width: 50% !important;
    flex: 0 0 50% !important;
    max-width: 50% !important;
    padding-left: 6px !important;
    padding-right: 6px !important;
    margin-bottom: 0;
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
  }
}
</style>
