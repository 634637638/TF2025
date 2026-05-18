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
              placeholder="请输入用户手机号"
              clearable
              maxlength="11"
              @input="handlePhoneInput"
              @focus="handlePhoneFocus"
              @blur="handlePhoneBlur"
              :readonly="selectedCustomer !== null"
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
              </div>
              <div
                v-else-if="formData.customer_phone.length >= 11 && !selectedCustomer && !customerSearching"
                class="create-new-customer"
                @click="autoCreateCustomer"
              >
                <i class="fas fa-user-plus"></i>
                点击创建该用户
              </div>
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="客户姓名" prop="customer_name" required>
            <div class="customer-name-group">
              <el-input
                :ref="customerNameInputRef"
                v-model="formData.customer_name"
                name="wholesale-customer-name"
                placeholder=""
                :readonly="!selectedCustomer && !customerCreating ? true : !customerNameEditing"
                @dblclick="enableCustomerNameEdit"
                @touchend="handleCustomerNameTouchEnd"
                @input="handleCustomerNameInput"
                @blur="handleCustomerNameBlur"
              >
                <template #prefix>
                  <i class="fas fa-user"></i>
                </template>
              </el-input>
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
              placeholder="请输入用户手机号"
              clearable
              maxlength="11"
              @input="handlePhoneInput"
              @focus="handlePhoneFocus"
              @blur="handlePhoneBlur"
              :readonly="selectedCustomer !== null"
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
              </div>
              <div
                v-else-if="formData.customer_phone.length >= 11 && !selectedCustomer && !customerSearching"
                class="create-new-customer"
                @click="autoCreateCustomer"
              >
                <i class="fas fa-user-plus"></i>
                点击创建该用户
              </div>
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="客户姓名" prop="customer_name">
            <div class="customer-name-group">
              <el-input
                :ref="customerNameInputRef"
                v-model="formData.customer_name"
                name="wholesale-customer-name"
                placeholder=""
                :readonly="!selectedCustomer && !customerCreating ? true : !customerNameEditing"
                @dblclick="enableCustomerNameEdit"
                @touchend="handleCustomerNameTouchEnd"
                @input="handleCustomerNameInput"
                @blur="handleCustomerNameBlur"
              >
                <template #prefix>
                  <i class="fas fa-user"></i>
                </template>
              </el-input>
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
  customerNameEditing: boolean
  customerCreating: boolean
  handlePhoneInput: (value: string) => void
  handlePhoneFocus: () => void
  handlePhoneBlur: () => void
  handleCustomerNameInput: (value: string) => void
  enableCustomerNameEdit: (event?: MouseEvent) => void
  handleCustomerNameTouchEnd: () => void
  handleCustomerNameBlur: () => void
  saveCustomerNameEdit: () => void
  clearSelectedCustomer: () => void
  customerNameInputRef?: any
  selectCustomer: (customer: WholesaleCustomerSearchItem) => void
  autoCreateCustomer: () => void | Promise<void>
  handlePaymentMethodChange: () => void
  handlePaymentChannelChange: () => void
}

defineProps<Props>()

const getVipLabel = (vipLevel?: string) => {
  const labels: Record<string, string> = {
    normal: '普通',
    silver: '银卡',
    gold: '金卡',
    platinum: '白金'
  }

  return labels[vipLevel || 'normal'] || '普通'
}
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
  border: 1px solid #ddd;
  border-radius: 6px;
  margin-top: 4px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1001;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.searching {
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
  background: #f8f9fa;
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
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.2;
  min-width: 0;
}

.customer-phone {
  font-size: 12px;
  color: #475569;
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

.create-new-customer {
  padding: 16px 20px;
  background: #f8f9fa;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #28a745;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.create-new-customer:hover {
  background: #e9ecef;
}

.customer-name-group {
  display: flex;
  align-items: stretch;
}

.customer-name-group :deep(.el-input) {
  flex: 1;
}

.customer-name-group :deep(.el-input__wrapper) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
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

  .customer-lock-button {
    width: 32px !important;
    min-width: 32px !important;
    height: 32px !important;
    flex-basis: 32px !important;
  }

  .customer-lock-button i {
    font-size: 13px;
  }

  .customer-headline,
  .customer-subline {
    gap: 6px;
  }

  .customer-info {
    gap: 6px;
  }

  .member-number,
  .vip-badge {
    font-size: 8px;
    padding: 1px 5px;
    line-height: 1.1;
    white-space: nowrap;
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

  .create-new-customer {
    padding: 10px 12px;
    font-size: 12px;
  }
}
</style>
