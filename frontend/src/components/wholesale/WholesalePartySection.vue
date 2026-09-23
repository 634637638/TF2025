<template>
  <section class="form-section wholesale-party-section">
    <template v-if="mode === 'wholesale'">
      <h4 class="section-title">
        <i class="fas fa-user" />
        客户信息
      </h4>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item
            label="手机号码"
            prop="customer_phone"
            required
            class="customer-search-form-item"
          >
            <el-input
              v-model="formData.customer_phone"
              placeholder="请输入用户手机号"
              clearable
              maxlength="11"
              :readonly="selectedCustomer !== null"
              @input="handlePhoneInput"
              @focus="handlePhoneFocus"
              @blur="handlePhoneBlur"
            >
              <template #prefix>
                <i class="fas fa-mobile-alt" />
              </template>
            </el-input>

            <CustomerSearchDropdown
              :items="customerSearchResults"
              :loading="customerSearching"
              :visible="showCustomerSearch && !selectedCustomer"
              :keyword="formData.customer_phone"
              :min-query-length="11"
              @select="selectCustomer($event)"
              @create="autoCreateCustomer"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item
            label="客户姓名"
            prop="customer_name"
            required
          >
            <CustomerNameLockInput
              :ref="customerNameInputRef"
              v-model="formData.customer_name"
              name="wholesale-customer-name"
              :selected="selectedCustomer !== null"
              :editing="customerNameEditing"
              :creating="customerCreating"
              @unlock="enableCustomerNameEdit"
              @touchend="handleCustomerNameTouchEnd"
              @input="handleCustomerNameInput"
              @blur="handleCustomerNameBlur"
              @save="saveCustomerNameEdit"
              @clear="clearSelectedCustomer"
            >
              <template #prefix>
                <i class="fas fa-user" />
              </template>
            </CustomerNameLockInput>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item
            label="销售时间"
            prop="sale_time"
            required
          >
            <el-date-picker
              v-model="formData.sale_time"
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
          <el-form-item
            label="销售门店"
            prop="store_id"
          >
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
          <el-form-item
            label="支付方式"
            prop="payment_method"
          >
            <PaymentMethodSelect
              v-model="formData.payment_method"
              variant="sale"
              placeholder="请选择"
              clearable
              class="w-full"
              @change="handlePaymentMethodChange"
            />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item
            v-if="formData.payment_method === 'mobile' || formData.payment_method === 'bank_card' || formData.payment_method === 'subsidy_card'"
            label="支付渠道"
            prop="payment_channel"
          >
            <PaymentChannelSelect
              v-model="formData.payment_channel"
              :payment-method="formData.payment_method"
              placeholder="请选择"
              clearable
              class="w-full"
              @change="handlePaymentChannelChange"
            />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item
            label="发票号"
            prop="invoice_number"
          >
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
        <i class="fas fa-truck" />
        供应商信息
      </h4>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item
            label="供应商"
            prop="supplier_id"
            required
          >
            <el-input
              :value="selectedSupplierName"
              placeholder="供应商"
              readonly
              class="w-full"
            >
              <template #prefix>
                <i class="fas fa-truck" />
              </template>
            </el-input>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item
            label="销售门店"
            prop="store_id"
          >
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
          <el-form-item
            label="划拨时间"
            prop="sale_time"
            required
          >
            <el-date-picker
              v-model="formData.sale_time"
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
          <el-form-item
            label="客户手机"
            prop="customer_phone"
            class="customer-search-form-item"
          >
            <el-input
              v-model="formData.customer_phone"
              placeholder="请输入用户手机号"
              clearable
              maxlength="11"
              :readonly="selectedCustomer !== null"
              @input="handlePhoneInput"
              @focus="handlePhoneFocus"
              @blur="handlePhoneBlur"
            >
              <template #prefix>
                <i class="fas fa-mobile-alt" />
              </template>
            </el-input>

            <CustomerSearchDropdown
              :items="customerSearchResults"
              :loading="customerSearching"
              :visible="showCustomerSearch && !selectedCustomer"
              :keyword="formData.customer_phone"
              :min-query-length="11"
              @select="selectCustomer($event)"
              @create="autoCreateCustomer"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item
            label="客户姓名"
            prop="customer_name"
          >
            <CustomerNameLockInput
              :ref="customerNameInputRef"
              v-model="formData.customer_name"
              name="wholesale-customer-name"
              :selected="selectedCustomer !== null"
              :editing="customerNameEditing"
              :creating="customerCreating"
              @unlock="enableCustomerNameEdit"
              @touchend="handleCustomerNameTouchEnd"
              @input="handleCustomerNameInput"
              @blur="handleCustomerNameBlur"
              @save="saveCustomerNameEdit"
              @clear="clearSelectedCustomer"
            >
              <template #prefix>
                <i class="fas fa-user" />
              </template>
            </CustomerNameLockInput>
          </el-form-item>
        </el-col>
      </el-row>
    </template>
  </section>
</template>

<script setup lang="ts">
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import CustomerSearchDropdown from '@/components/common/CustomerSearchDropdown.vue'
import { PaymentChannelSelect, PaymentMethodSelect } from '@/components/payment'
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
  handlePhoneInput: (_value: string) => void
  handlePhoneFocus: () => void
  handlePhoneBlur: () => void
  handleCustomerNameInput: (_value: string) => void
  enableCustomerNameEdit: (_event?: MouseEvent) => void
  handleCustomerNameTouchEnd: () => void
  handleCustomerNameBlur: () => void
  saveCustomerNameEdit: () => void
  clearSelectedCustomer: () => void
  customerNameInputRef?: any
  selectCustomer: (_customer: WholesaleCustomerSearchItem) => void
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
  border-bottom: 1px solid var(--tf-color-surface-ant);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--tf-color-indigo-brand);
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
  border: 1px solid var(--tf-color-gray-300-alt);
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
  color: var(--text-secondary);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.customer-item {
  padding: 16px 20px;
  border-bottom: 1px solid var(--tf-color-gray-200-alt);
  cursor: pointer;
  transition: background-color 0.2s;
}

.customer-item:hover {
  background: var(--tf-color-surface-muted);
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
  color: var(--tf-color-neutral-800);
  line-height: 1.2;
  min-width: 0;
}

.customer-phone {
  font-size: 12px;
  color: var(--tf-color-slate-600);
  line-height: 1.2;
}

.member-number {
  background: linear-gradient(135deg, var(--tf-color-surface-blue-soft) 0%, var(--tf-color-blue-tailwind-100) 100%);
  color: var(--tf-color-blue-700);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  justify-self: end;
}

.vip-badge {
  background: linear-gradient(135deg, var(--tf-color-rose-400) 0%, var(--tf-color-amber-500) 100%);
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
  background: var(--tf-color-surface-muted);
  cursor: pointer;
  transition: background-color 0.2s;
  color: var(--success-color);
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.create-new-customer:hover {
  background: var(--tf-color-border-muted);
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
