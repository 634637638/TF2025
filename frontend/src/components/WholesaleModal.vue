<template>
  <MobileDialog
    :model-value="visible"
    width="720px"
    dialog-class="wholesale-form-dialog"
    :show-close="true"
    :show-default-footer="false"
    :close-on-click-modal="props.closeOnClickModal !== false"
    @update:modelValue="emit('update:visible', $event)"
    @closed="resetForm"
  >
    <template #header>
      <div class="wholesale-modal-header">
        <div class="header-left">
          <div class="header-text">
            <h3>{{ mode === 'wholesale' ? '调货' : '划拨' }}</h3>
            <p>已选 {{ phoneCount }} 台</p>
          </div>
        </div>
      </div>
    </template>

    <div class="wholesale-modal-body">
          <el-form :model="formData" :rules="formRules" ref="formRef" label-width="100px">
            <!-- 批发模式：客户信息 -->
            <div v-if="mode === 'wholesale'" class="form-section">
              <h4 class="section-title">
                <i class="fas fa-user"></i>
                客户信息
              </h4>

              <!-- 手机号和姓名一行显示 -->
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="手机号码" prop="customer_phone" required class="customer-search-form-item">
                    <el-input
                      v-model="formData.customer_phone"
                      placeholder="请输入手机号码"
                      clearable
                      @input="handlePhoneInput"
                      @focus="handlePhoneFocus"
                      @blur="handlePhoneBlur"
                      maxlength="11"
                    >
                      <template #prefix>
                        <i class="fas fa-mobile-alt"></i>
                      </template>
                    </el-input>
                    <!-- 客户搜索结果 -->
                    <div v-if="showCustomerSearch && (customerSearchResults.length > 0 || customerSearching || (formData.customer_phone.length >= 11 && !selectedCustomer && !customerSearching))" class="customer-search-results">
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
                      <div v-else-if="formData.customer_phone.length >= 11 && !selectedCustomer && !customerSearching" class="create-new-customer" @click="autoCreateCustomer">
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

              <!-- 销售时间和销售员 -->
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

              <!-- 销售门店 -->
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

              <!-- 手机列表展示 -->
              <div class="phones-display">
                <div class="display-header">
                  <span>手机列表（{{ phoneCount }}台）</span>
                </div>
                <div class="phones-list">
                  <div v-for="(phone, index) in displayPhones" :key="phone.id" class="phone-item">
                    <div class="phone-main">
                      <div class="phone-left">
                        <span class="phone-index">{{ index + 1 }}</span>
                        <span class="phone-detail">{{ phone.brand }} {{ phone.model }} - {{ phone.color }} {{ phone.memory }}</span>
                      </div>
                      <div class="phone-prices phone-prices-two-col">
                        <div class="price-item">
                          <span class="price-label">入库价:</span>
                          <el-input-number
                            v-model="phone.editCost"
                            :min="0"
                            :precision="0"
                            :step="100"
                            :controls="false"
                            size="small"
                            placeholder="入库价"
                            class="price-input"
                            @change="handleCostChange"
                          />
                        </div>
                        <div class="price-item">
                          <span class="price-label">批发:</span>
                          <el-input-number
                            v-model="phone.wholesalePrice"
                            :min="1"
                            :precision="0"
                            :step="100"
                            :controls="false"
                            size="small"
                            placeholder="批发价"
                            class="price-input"
                          />
                        </div>
                        <div class="price-item profit-display">
                          <span class="price-label">利润:</span>
                          <span class="price-value" :class="(phone.wholesalePrice || 0) - (phone.editCost || 0) >= 0 ? 'profit' : 'loss'">
                            ¥{{ formatPrice((phone.wholesalePrice || 0) - (phone.editCost || 0)) }}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div class="phone-extra">
                      <span class="phone-supplier">供应商: {{ phone.supplier_name || '-' }}</span>
                      <span class="phone-store">店铺: {{ phone.store_name || '-' }}</span>
                      <span class="phone-inventory-date">入库时间: {{ formatDate(phone.Inventorytime || phone.purchase_date || phone.created_at) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 价格汇总 -->
              <div class="price-summary">
                <div class="summary-item">
                  <span>总入库价:</span>
                  <span class="price-value">¥{{ formatPrice(totalCost) }}</span>
                </div>
                <div class="summary-item">
                  <span>批发总价:</span>
                  <span class="price-value">¥{{ formatPrice(totalWholesalePrice) }}</span>
                </div>
                <div class="summary-item profit">
                  <span>预估利润:</span>
                  <span class="price-value">¥{{ formatPrice(totalWholesalePrice - totalCost) }}</span>
                </div>
              </div>

              <!-- 支付方式和发票号 -->
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
            </div>

            <!-- 划拨模式：供应商信息 -->
            <div v-else class="form-section">
              <h4 class="section-title">
                <i class="fas fa-truck"></i>
                供应商信息
              </h4>

              <!-- 供应商和门店一行显示 -->
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

              <!-- 销售时间和销售员 -->
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

              <!-- 手机号和姓名一行显示 -->
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="客户手机" prop="customer_phone" class="customer-search-form-item">
                    <el-input
                      v-model="formData.customer_phone"
                      placeholder="客户手机号（可选）"
                      clearable
                      @input="handlePhoneInput"
                      @focus="handlePhoneFocus"
                      @blur="handlePhoneBlur"
                      maxlength="11"
                    >
                      <template #prefix>
                        <i class="fas fa-mobile-alt"></i>
                      </template>
                    </el-input>
                    <!-- 客户搜索结果 -->
                    <div v-if="showCustomerSearch && (customerSearchResults.length > 0 || customerSearching || (formData.customer_phone.length >= 11 && !selectedCustomer && !customerSearching))" class="customer-search-results">
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
                      <div v-else-if="formData.customer_phone.length >= 11 && !selectedCustomer && !customerSearching" class="create-new-customer" @click="autoCreateCustomer">
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

              <!-- 手机列表展示 -->
              <div class="phones-display">
                <div class="display-header">
                  <span>手机列表（{{ phoneCount }}台）</span>
                </div>
                <div class="phones-list">
                  <div v-for="(phone, index) in displayPhones" :key="phone.id" class="phone-item">
                    <div class="phone-main">
                      <div class="phone-left">
                        <span class="phone-index">{{ index + 1 }}</span>
                        <span class="phone-detail">{{ phone.brand }} {{ phone.model }} - {{ phone.color }} {{ phone.memory }}</span>
                      </div>
                      <div class="phone-prices">
                        <div class="price-item">
                          <span class="price-label">入库:</span>
                          <el-input-number
                            v-model="phone.editCost"
                            :min="0"
                            :precision="0"
                            :step="100"
                            :controls="false"
                            size="small"
                            placeholder="入库价"
                            class="price-input"
                            :disabled="mode === 'proxy'"
                            @change="handleCostChange"
                          />
                        </div>
                        <div class="price-item">
                          <span class="price-label">{{ mode === 'proxy' ? '划拨价' : '销售价' }}:</span>
                          <el-input-number
                            v-model="phone.wholesalePrice"
                            :min="0"
                            :precision="0"
                            :step="100"
                            :controls="false"
                            size="small"
                            :placeholder="mode === 'proxy' ? '划拨价' : '销售价'"
                            class="price-input"
                            :disabled="mode === 'proxy'"
                          />
                        </div>
                      </div>
                    </div>
                    <div class="phone-extra">
                      <span class="phone-supplier">供应商: {{ phone.supplier_name || '-' }}</span>
                      <span class="phone-store">店铺: {{ phone.store_name || '-' }}</span>
                      <span class="phone-inventory-date">入库时间: {{ formatDate(phone.Inventorytime || phone.purchase_date || phone.created_at) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 价格汇总 -->
              <div class="price-summary">
                <div class="summary-item">
                  <span>总入库价:</span>
                  <span class="price-value">¥{{ formatPrice(totalCost) }}</span>
                </div>
                <div class="summary-item">
                  <span>销售总价:</span>
                  <span class="price-value">¥{{ formatPrice(totalWholesalePrice) }}</span>
                </div>
                <div class="summary-item">
                  <span>划拨数量:</span>
                  <span class="price-value">{{ phoneCount }} 台</span>
                </div>
              </div>

              <el-alert
                type="warning"
                :closable="false"
                show-icon
                class="mt-3"
              >
                <template #default>
                  <div>应供应商要求进行以上商品实施划拨！</div>
                </template>
              </el-alert>
            </div>

            <!-- 通用：备注 -->
            <div class="form-section">
              <h4 class="section-title">
                <i class="fas fa-comment"></i>
                备注信息
              </h4>
              <el-form-item label="备注" prop="remarks">
                <el-input
                  v-model="formData.remarks"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入备注信息"
                  maxlength="200"
                  show-word-limit
                />
              </el-form-item>
            </div>
          </el-form>
    </div>

    <template #footer>
      <div class="wholesale-modal-footer">
        <el-button type="default" @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ submitting ? '处理中...' : '确认' }}
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { ValidationRules } from '@/composables'
import { unifiedApi } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { isValidMobilePhone, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { logger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'
import type { Supplier, Store, User } from '@/types'
import type { VisibleProps } from '@/types/component'

interface CustomerSearchItem {
  id: number
  name: string
  phone: string
}

interface WholesalePhone {
  id: number
  brand?: string
  model?: string
  color?: string
  memory?: string
  purchase_cost?: number | string | null
  purchase_price?: number | string | null
  editCost?: number | null
  wholesalePrice?: number | null
  supplier_name?: string
  store_name?: string
  Inventorytime?: string
  purchase_date?: string
  created_at?: string
}

interface EditableWholesalePhone extends WholesalePhone {
  editCost: number
  wholesalePrice: number
}

interface CollectedPriceItem {
  brand_name?: string
  model_number?: string
  color_name?: string
  memory?: string
  wholesale_price?: number | string | null
  retail_price?: number | string | null
}

interface TransferPhonePayload {
  phone_id: number
  purchase_cost: number
  wholesale_price: number
}

interface TransferSubmitPayload {
  phone_ids: number[]
  phones: TransferPhonePayload[]
  remarks: string
  customer_id?: number
  customer_name?: string
  customer_phone?: string
  supplier_id?: number | null
  store_id?: number | null
  salesperson_name?: string
  payment_method?: string
  invoice_number?: string
  sale_date?: string
}

interface Props extends VisibleProps {
  mode: 'wholesale' | 'proxy'
  phoneIds: number[]
  phones: WholesalePhone[]
  closeOnClickModal?: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success', data: { success_count: number; total_count: number; message: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const customerSearching = ref(false)
const searchTimer = ref<number | null>(null)
const showCustomerSearch = ref(false)
const selectedCustomer = ref<CustomerSearchItem | null>(null)
const customerSearchResults = ref<CustomerSearchItem[]>([])
const customerSearchCache = ref(new Map<string, CustomerSearchItem[]>())
const isSelectingCustomer = ref(false)

// 表单数据
const formData = ref({
  customer_id: null as number | null,
  customer_name: '',
  customer_phone: '',
  supplier_id: null as number | null,
  store_id: null as number | null,
  salesperson_name: '',
  wholesale_price: null as number | null,
  payment_method: '',
  payment_channel: '',
  invoice_number: '',
  sale_date: '', // 销售时间
  remarks: ''
})

// 表单验证规则 - 划拨模式下客户信息可选，批发模式下必填
const formRules = computed(() => {
  const rules: FormRules = {
    supplier_id: [
      ValidationRules.required('请选择供应商')
    ],
    sale_date: [
      ValidationRules.required('请选择销售时间')
    ]
  }

  // 批发模式下客户信息必填
  if (props.mode === 'wholesale') {
    rules.customer_phone = [
      ValidationRules.required('请输入手机号码'),
      ValidationRules.phone()
    ]
    rules.customer_name = [
      ValidationRules.required('请输入客户姓名')
    ]
  }

  return rules
})

// 供应商列表
const suppliers = ref<Supplier[]>([])
// 门店列表
const stores = ref<Store[]>([])
// 用户列表（销售员）
const users = ref<User[]>([])
// 是否有单个供应商
const hasSingleSupplier = ref(false)

// 显示的手机列表（使用原始数据）
const editablePhones = ref<EditableWholesalePhone[]>([])
// 采集价格数据缓存
const collectedPrices = ref<CollectedPriceItem[]>([])

const normalizeCustomerSearchItem = (customer: Partial<CustomerSearchItem> | null | undefined): CustomerSearchItem => ({
  id: Number(customer?.id || 0),
  name: normalizePersonName(customer?.name || '', 20),
  phone: normalizePhoneDigits(customer?.phone || '')
})

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response
    if (typeof response?.data?.message === 'string' && response.data.message) {
      return response.data.message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

// 获取采集价格数据
const loadCollectedPrices = async () => {
  try {
    const response = await unifiedApi.get('/public/price/all')
    if (response.success) {
      collectedPrices.value = Array.isArray(response.data) ? response.data as CollectedPriceItem[] : []
    }
  } catch (error) {
    logger.error('获取采集价格失败:', error)
  }
}

// 根据手机信息匹配采集价格
const matchCollectedPrice = (phone: WholesalePhone) => {
  if (!collectedPrices.value || collectedPrices.value.length === 0) {
    return null
  }

  // 尝试精确匹配：品牌、型号、颜色、内存都匹配
  const exactMatch = collectedPrices.value.find((price) => {
    const brandMatch = !price.brand_name || price.brand_name === phone.brand
    const modelMatch = !price.model_number || price.model_number === phone.model
    const colorMatch = !price.color_name || price.color_name === phone.color
    const memoryMatch = !price.memory || price.memory === phone.memory
    return brandMatch && modelMatch && colorMatch && memoryMatch
  })

  if (exactMatch) {
    return Number(exactMatch.wholesale_price || exactMatch.retail_price || 0)
  }

  // 尝试模糊匹配：品牌、型号匹配即可
  const fuzzyMatch = collectedPrices.value.find((price) => {
    const brandMatch = !price.brand_name || price.brand_name === phone.brand
    const modelMatch = !price.model_number || price.model_number === phone.model
    return brandMatch && modelMatch
  })

  if (fuzzyMatch) {
    return Number(fuzzyMatch.wholesale_price || fuzzyMatch.retail_price || 0)
  }

  return null
}

// 计算选中的供应商名称
const selectedSupplierName = computed(() => {
  if (!formData.value.supplier_id) return ''
  const supplier = suppliers.value.find(s => s.id === formData.value.supplier_id)
  return supplier ? supplier.name : ''
})

// 监听 props.phones 变化，初始化可编辑数据
watch(() => props.phones, async (newPhones) => {
  if (newPhones && newPhones.length > 0) {
    // 划拨模式：供应商设置将在 watch(() => props.visible) 中供应商列表加载完成后进行

    // 批发模式时加载采集价格，划拨模式时清除采集价格
    if (props.mode === 'wholesale') {
      await loadCollectedPrices()
    } else {
      // 划拨模式：清除采集价格缓存，确保不使用批发价格
      collectedPrices.value = []
    }

    // 划拨模式：入库价格和销售价都默认为0
    const isProxyMode = props.mode === 'proxy'
    editablePhones.value = newPhones.map(phone => {
      // 只有批发模式才匹配采集价格
      const collectedPrice = !isProxyMode ? matchCollectedPrice(phone) : null
      const baseCost = Number(phone.editCost || phone.purchase_cost || phone.purchase_price || 0)

      return {
        ...phone,
        // 划拨模式强制为0，批发模式使用基础价格
        editCost: isProxyMode ? 0 : baseCost,
        // 划拨模式强制为0，批发模式使用采集价格或批发价或基础价格
        // 确保 collectedPrice 和 wholesalePrice 都转换为数字
        wholesalePrice: isProxyMode ? 0 : (Number(collectedPrice || 0) || Number(phone.wholesalePrice) || baseCost)
      }
    })
  }
}, { immediate: true, deep: true })

// 监听 mode 变化，切换模式时重新初始化价格
watch(() => props.mode, async (newMode) => {
  if (editablePhones.value.length > 0) {
    // 切换到批发模式时加载采集价格
    if (newMode === 'wholesale') {
      await loadCollectedPrices()
    } else {
      // 切换到划拨模式时清除采集价格缓存
      collectedPrices.value = []
    }

    // 重新初始化所有手机价格
    const isProxyMode = newMode === 'proxy'
    editablePhones.value = editablePhones.value.map(phone => {
      const collectedPrice = !isProxyMode ? matchCollectedPrice(phone) : null
      const baseCost = Number(phone.editCost || phone.purchase_cost || phone.purchase_price || 0)

      return {
        ...phone,
        editCost: isProxyMode ? 0 : baseCost,
        // 确保 collectedPrice 和 wholesalePrice 都转换为数字
        wholesalePrice: isProxyMode ? 0 : (Number(collectedPrice || 0) || Number(phone.wholesalePrice) || baseCost)
      }
    })
  }
})

const displayPhones = computed(() => editablePhones.value)

const normalizeCustomerPhone = (phone: unknown) => normalizePhoneDigits(phone)

// 计算属性
const phoneCount = computed(() => props.phoneIds?.length || 0)

const totalCost = computed(() => {
  return displayPhones.value.reduce((sum, phone) => {
    // 划拨模式使用 editCost（已设置为0），批发模式使用 editCost 或原始价格
    return sum + (phone.editCost || 0)
  }, 0)
})

// 计算总批发价
const totalWholesalePrice = computed(() => {
  return displayPhones.value.reduce((sum, phone) => {
    return sum + (phone.wholesalePrice || 0)
  }, 0)
})

// 格式化价格（移除整数的.00后缀）
const formatPrice = (price: number) => {
  const formatted = price.toFixed(2)
  // 如果是整数，移除.00后缀
  return formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted
}

// 格式化日期（修复时区问题）
const formatDate = (date: string | null | undefined) => {
  if (!date) return '-'

  let d: Date
  // 检查是否是纯日期格式 (YYYY-MM-DD)，不包含时间部分
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date)

  if (isDateOnly) {
    // 纯日期格式，添加时间部分避免被解析为UTC时间
    d = new Date(date + 'T00:00:00')
  } else if (date.includes(' ')) {
    // MySQL DATETIME 格式 (YYYY-MM-DD HH:mm:ss)，将空格替换为 T
    d = new Date(date.replace(' ', 'T'))
  } else {
    // 其他格式（如 ISO 格式），直接解析
    d = new Date(date)
  }

  if (isNaN(d.getTime())) return '-'
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 处理入库价变化
const handleCostChange = () => {
  // 触发计算属性重新计算
}

// 支付方式变化处理
const handlePaymentMethodChange = () => {
  // 清空支付渠道
  formData.value.payment_channel = ''
}

// 支付渠道变化处理（保留，以防需要）
const handlePaymentChannelChange = () => {
  // 可以在这里添加额外的逻辑
}

// 处理手机号聚焦
const handlePhoneFocus = () => {
  if (formData.value.customer_phone.length >= 11) {
    showCustomerSearch.value = true
  }
}

// 处理手机号失焦
const handlePhoneBlur = () => {
  // 延迟隐藏，以便点击搜索结果
  setTimeout(() => {
    if (!isSelectingCustomer.value) {
      showCustomerSearch.value = false
    }
  }, 200)
}

// 处理手机号输入
const handlePhoneInput = (value: string) => {
  // 清除非数字字符
  const cleanedValue = normalizeCustomerPhone(value)
  formData.value.customer_phone = cleanedValue

  // 清除选中的客户
  if (selectedCustomer.value && normalizeCustomerPhone(selectedCustomer.value.phone) !== cleanedValue) {
    selectedCustomer.value = null
    formData.value.customer_id = null
  }

  // 清除之前的定时器
  if (searchTimer.value) {
    clearTimeout(searchTimer.value)
  }

  // 如果输入为空，清空结果
  if (!cleanedValue) {
    customerSearchResults.value = []
    showCustomerSearch.value = false
    return
  }

  // 始终显示搜索框，立即搜索（与销售页面一致）
  showCustomerSearch.value = true
  searchTimer.value = window.setTimeout(async () => {
    await searchCustomers(cleanedValue)
  }, 300)
}

const handleCustomerNameInput = (value: string) => {
  formData.value.customer_name = normalizePersonName(value, 20)
}

// 搜索客户
const searchCustomers = async (phoneNumber: string) => {
  try {
    // 检查缓存
    if (customerSearchCache.value.has(phoneNumber)) {
      const cachedResults = customerSearchCache.value.get(phoneNumber)
      customerSearchResults.value = cachedResults
      return
    }

    customerSearching.value = true

    const response = await unifiedApi.get(`/sales/customers?search=${encodeURIComponent(phoneNumber)}`)

    if (response.success) {
      const results = extractResponseData<Array<Partial<CustomerSearchItem>>>(response)
        .map((item) => normalizeCustomerSearchItem(item))
      customerSearchResults.value = results
      // 缓存结果
      customerSearchCache.value.set(phoneNumber, results)
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

// 选择客户
const selectCustomer = (customer: CustomerSearchItem) => {
  isSelectingCustomer.value = true
  selectedCustomer.value = customer
  formData.value.customer_id = customer.id
  formData.value.customer_phone = normalizeCustomerPhone(customer.phone)
  formData.value.customer_name = normalizePersonName(customer.name, 20)
  showCustomerSearch.value = false
  customerSearchResults.value = []

  // 清除表单验证错误
  nextTick(() => {
    formRef.value?.clearValidate('customer_phone')
    formRef.value?.clearValidate('customer_name')
  })

  setTimeout(() => {
    isSelectingCustomer.value = false
  }, 300)
}

// 自动创建新客户
const autoCreateCustomer = async () => {
  const normalizedCustomerPhone = normalizeCustomerPhone(formData.value.customer_phone)
  const normalizedCustomerName = normalizePersonName(formData.value.customer_name, 20)

  if (!normalizedCustomerName) {
    formData.value.customer_name = '客户'
  } else {
    formData.value.customer_name = normalizedCustomerName
  }

  if (!isValidMobilePhone(normalizedCustomerPhone)) {
    ElMessage.error('请输入有效的手机号码')
    return
  }

  try {
    // 根据模式设置客户类型：wholesale 模式=同行调货，proxy 模式=同行划拨
    const customerType = props.mode === 'wholesale' ? 'wholesale' : 'allocate'

    const newCustomerData = {
      name: formData.value.customer_name,
      phone: normalizedCustomerPhone,
      customer_type: customerType,
      vip_level: 'normal'
    }

    const response = await unifiedApi.post('/customers', newCustomerData)

    if (response.success) {
      const newCustomer = normalizeCustomerSearchItem(response.data as Partial<CustomerSearchItem>)
      selectedCustomer.value = newCustomer
      formData.value.customer_id = newCustomer.id
      formData.value.customer_phone = normalizeCustomerPhone(newCustomer.phone)
      formData.value.customer_name = normalizePersonName(newCustomer.name, 20)
      showCustomerSearch.value = false
      customerSearchResults.value = []
      ElMessage.success('新客户创建成功')
    }
  } catch (error: unknown) {
    logger.error('创建客户失败:', error)
    ElMessage.error(resolveErrorMessage(error, '创建客户失败'))
  }
}

// 加载供应商列表
const loadSuppliers = async () => {
  try {
    const response = await unifiedApi.get('/suppliers', {
      params: { page: 1, limit: 1000, all: true }
    })

    if (response.success) {
      suppliers.value = Array.isArray(response.data) ? response.data as Supplier[] : []
    }
  } catch (error) {
    logger.error('加载供应商列表失败:', error)
  }
}

// 加载门店列表
const loadStores = async () => {
  try {
    const response = await unifiedApi.get('/stores', {
      params: { page: 1, limit: 1000, all: true }
    })

    if (response.success) {
      stores.value = Array.isArray(response.data) ? response.data as Store[] : []
    }
  } catch (error) {
    logger.error('加载门店列表失败:', error)
  }
}

// 加载用户列表（销售员）
const loadUsers = async () => {
  try {
    const response = await unifiedApi.get('/users/operators')

    if (response.success) {
      users.value = Array.isArray(response.data?.users)
        ? response.data.users as User[]
        : Array.isArray(response.data)
          ? response.data as User[]
          : []
      // 设置默认销售员为当前登录用户
      if (authStore.user && authStore.user.name && !formData.value.salesperson_name) {
        formData.value.salesperson_name = authStore.user.name
      }
    }
  } catch (error) {
    logger.error('加载用户列表失败:', error)
  }
}

// 获取当前模式
const mode = computed(() => props.mode)

// 重置表单
const resetForm = () => {
  formData.value = {
    customer_id: null,
    customer_name: '',
    customer_phone: '',
    supplier_id: null,
    store_id: null,
    salesperson_name: '',
    wholesale_price: null,
    payment_method: '',
    payment_channel: '',
    invoice_number: '',
    sale_date: '',
    remarks: ''
  }
  selectedCustomer.value = null
  customerSearchResults.value = []
  showCustomerSearch.value = false
  formRef.value?.resetFields()
}

// 关闭对话框
const handleClose = () => {
  emit('update:visible', false)
  resetForm()
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    // 划拨模式：验证供应商（已经在打开模态框前验证过，这里只做简单检查）
    if (props.mode === 'proxy') {
      if (!formData.value.supplier_id) {
        ElMessage.error('请选择供应商')
        return
      }
    }

    // 批发模式：验证是否所有手机都设置了批发价格（必须大于0）
    // 划拨模式：价格可以为0，不验证
    if (props.mode === 'wholesale') {
      const phonesWithoutPrice = editablePhones.value.filter(p => !p.wholesalePrice || p.wholesalePrice <= 0)
      if (phonesWithoutPrice.length > 0) {
        ElMessage.warning(`请为所有手机设置批发价格（当前有 ${phonesWithoutPrice.length} 台未设置或价格为0）`)
        return
      }
    }

    // 批发模式需要验证表单（包含客户信息），划拨模式只验证供应商
    if (props.mode === 'wholesale') {
      // 使用统一验证规则进行表单验证
      try {
        await formRef.value.validate()
      } catch {
        // validate 失败会自动显示错误提示，无需额外处理
        return
      }
    }

    submitting.value = true
    const normalizedCustomerPhone = normalizeCustomerPhone(formData.value.customer_phone)
    const normalizedCustomerName = normalizePersonName(formData.value.customer_name, 20)
    formData.value.customer_name = normalizedCustomerName

    if (props.mode === 'wholesale' && !isValidMobilePhone(normalizedCustomerPhone)) {
      ElMessage.error('请输入有效的手机号码')
      return
    }

    if (props.mode === 'proxy' && normalizedCustomerPhone && !isValidMobilePhone(normalizedCustomerPhone)) {
      ElMessage.error('请输入有效的手机号码')
      return
    }

    const url = props.mode === 'wholesale'
      ? '/transfers/wholesale'
      : '/transfers/proxy'

    const payload: TransferSubmitPayload = {
      phone_ids: props.phoneIds,
      phones: editablePhones.value.map(phone => ({
        phone_id: phone.id,
        // 划拨模式强制使用 editCost（已设为0），批发模式使用 editCost 或回退到原始价格
        purchase_cost: Number(props.mode === 'proxy' ? (phone.editCost ?? 0) : (phone.editCost ?? phone.purchase_cost ?? phone.purchase_price ?? 0)),
        wholesale_price: Number(phone.wholesalePrice ?? 0)
      })),
      remarks: formData.value.remarks
    }

    // 批发模式
    if (props.mode === 'wholesale') {
      if (selectedCustomer.value && selectedCustomer.value.id) {
        payload.customer_id = selectedCustomer.value.id
      } else {
        // 使用当前输入的信息
        payload.customer_name = normalizedCustomerName
        payload.customer_phone = normalizedCustomerPhone
      }
      // 包含门店、销售员、支付方式、发票号和销售时间信息
      payload.store_id = formData.value.store_id
      payload.salesperson_name = formData.value.salesperson_name
      payload.payment_method = formData.value.payment_method
      payload.invoice_number = formData.value.invoice_number
      payload.sale_date = formData.value.sale_date
    } else {
      // 代划拨模式
      payload.supplier_id = formData.value.supplier_id
      if (selectedCustomer.value && selectedCustomer.value.id) {
        payload.customer_id = selectedCustomer.value.id
      } else if (normalizedCustomerPhone) {
        payload.customer_name = normalizedCustomerName
        payload.customer_phone = normalizedCustomerPhone
      }
      // 包含门店、销售员和划拨时间
      payload.store_id = formData.value.store_id
      payload.salesperson_name = formData.value.salesperson_name
      payload.sale_date = formData.value.sale_date
    }

    const response = await unifiedApi.post(url, payload)

    if (response.success) {
      const successCount = response.data?.success_count || 0
      const totalCount = response.data?.total_count || props.phoneIds.length
      const message = response.message || `${props.mode === 'wholesale' ? '批发' : '划拨'}成功`

      ElMessage.success(message)
      emit('success', {
        success_count: successCount,
        total_count: totalCount,
        message
      })
      handleClose()
    } else {
      ElMessage.error(response.message || '操作失败')
    }
  } catch (error: unknown) {
    logger.error('提交失败:', error)
    ElMessage.error(resolveErrorMessage(error, '操作失败，请稍后重试'))
  } finally {
    submitting.value = false
  }
}

// 监听 visible 变化
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await loadSuppliers()
    await loadStores()
    await loadUsers()

    // 划拨模式：供应商列表加载完成后，自动设置供应商
    if (props.mode === 'proxy' && props.phones && props.phones.length > 0) {
      const supplierIds = [...new Set(props.phones.map(p => p.supplier_id).filter(id => id != null))]

      if (supplierIds.length === 1) {
        formData.value.supplier_id = supplierIds[0]
        hasSingleSupplier.value = true
      }
    }
  }
})
</script>

<style lang="scss">
.wholesale-form-dialog {
  --dialog-side-gap: 4px;
  --dialog-vertical-gap: 8px;
  --dialog-max-width: calc(100vw - 8px);
  --mobile-dialog-body-padding: 6px 6px 8px;
  --mobile-dialog-footer-padding: 0 6px 6px;
}

.wholesale-form-dialog .el-dialog {
  margin: auto !important;
  width: min(720px, calc(100vw - 32px)) !important;
  max-width: calc(100vw - 32px) !important;
  border-radius: 22px !important;
  overflow: hidden;
  border: 1px solid rgba(124, 58, 237, 0.12);
  box-shadow: 0 28px 72px rgba(15, 23, 42, 0.24);
  background: linear-gradient(180deg, #ffffff 0%, #faf7ff 100%);
}

.wholesale-form-dialog .el-dialog__header {
  padding: 0 !important;
  margin-right: 0 !important;
  border-bottom: 0 !important;
}

.wholesale-form-dialog .el-dialog__body,
.wholesale-form-dialog .el-dialog__footer {
  padding: 0 !important;
}

.wholesale-form-dialog.mobile-dialog-sheet-panel {
  border-radius: 24px !important;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24) !important;
}

.wholesale-form-dialog .mobile-dialog-sheet-header {
  min-height: calc(62px + env(safe-area-inset-top));
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px 14px !important;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
}

.wholesale-form-dialog .mobile-dialog-sheet-header-content {
  justify-content: flex-start;
}

@media (max-width: 767px) {
  .wholesale-form-dialog .el-dialog {
    width: calc(100vw - 8px) !important;
    max-width: calc(100vw - 8px) !important;
    border-radius: 18px !important;
  }

  .wholesale-form-dialog .mobile-dialog-sheet-header {
    min-height: calc(56px + env(safe-area-inset-top));
    padding: calc(8px + env(safe-area-inset-top)) 12px 8px 12px !important;
  }
}
</style>

<style lang="scss" scoped>
.wholesale-modal-header {
  width: 100%;
  background: transparent;
  padding: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  min-height: 0;

  .header-left {
    display: flex;
    align-items: center;
    min-width: 0;

    .header-text {
      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        line-height: 1.2;
      }

      p {
        margin: 2px 0 0 0;
        font-size: 12px;
        line-height: 1.2;
        opacity: 0.82;
      }
    }
  }

}

.wholesale-modal-body {
  padding: 24px;
  overflow-y: auto;
  max-height: calc(90vh - 140px);
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #f0f2f5;

  &:last-of-type {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: #667eea;

    i {
      font-size: 16px;
    }
  }
}

// 客户搜索结果样式
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

  .searching {
    padding: 12px 16px;
    text-align: center;
    color: #909399;
    font-size: 13px;

    i {
      margin-right: 6px;
    }
  }

  .results-list {
    .customer-item {
      padding: 10px 16px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      justify-content: space-between;
      align-items: center;

      &:hover {
        background: #f5f7fa;
      }

      .customer-info {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .customer-name {
          font-size: 14px;
          font-weight: 500;
          color: #303133;
        }

        .customer-phone {
          font-size: 12px;
          color: #909399;
        }
      }

      i {
        color: #67c23a;
        font-size: 16px;
      }
    }
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

    &:hover {
      background: #ecf5ff;
    }

    i {
      font-size: 14px;
    }
  }
}

// 客户搜索表单项样式
:deep(.customer-search-form-item) {
  .el-form-item__content {
    position: relative !important;
  }
}

.supplier-hint {
  font-size: 12px;
  color: #67c23a;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.supplier-warning {
  color: #e6a23c;
}

.phones-display {
  margin: 16px 0;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;

  .display-header {
    background: #f5f7fa;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 600;
    color: #606266;
    border-bottom: 1px solid #e4e7ed;
  }

  .supplier-display {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: #f5f7fa;
    border-radius: 6px;
    min-height: 32px;

    .supplier-name {
      font-size: 14px;
      font-weight: 500;
      color: #303133;
      flex: 1;
    }

    .supplier-hint {
      font-size: 12px;
      color: #67c23a;
      margin-left: 12px;
    }

    .supplier-warning {
      font-size: 14px;
      color: #e6a23c;
    }
  }

  .phones-list {
    max-height: 250px;
    overflow-y: auto;
  }

  .phone-item {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f2f5;

    &:last-child {
      border-bottom: none;
    }

    .phone-main {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;

      .phone-left {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;

        .phone-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: #667eea;
          color: white;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .phone-detail {
          font-size: 13px;
          color: #303133;
          font-weight: 500;
        }
      }

      .phone-prices {
        display: flex;
        align-items: center;
        gap: 12px;

        .price-item {
          display: flex;
          align-items: center;
          gap: 6px;

          .price-label {
            font-size: 12px;
            color: #909399;
            white-space: nowrap;
          }

          .price-value {
            font-size: 13px;
            font-weight: 600;
            min-width: 80px;

            &.cost {
              color: #f56c6c;
            }

            &.profit {
              color: #67c23a;
            }

            &.loss {
              color: #f56c6c;
            }
          }

          .price-input {
            width: 110px;
          }

          &.profit-display {
            .price-value {
              min-width: 70px;
            }
          }
        }
      }
    }

    .phone-extra {
      display: flex;
      gap: 16px;
      padding-left: 34px;
      font-size: 12px;
      color: #909399;
      flex-wrap: wrap;

      .phone-supplier,
      .phone-store,
      .phone-inventory-date {
        display: flex;
        align-items: center;
        gap: 4px;

        i {
          font-size: 11px;
        }
      }

      .phone-inventory-date {
        color: #67c23a;
      }
    }
  }
}

.price-summary {
  margin-top: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;

  .summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    flex: 1;

    &.profit {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #dcdfe6;
      font-weight: 600;
      color: #67c23a;
    }

    .price-value {
      font-weight: 600;
      color: #303133;
    }
  }
}

.form-tip {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 12px;
  color: #909399;

  i {
    font-size: 12px;
  }
}

.wholesale-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: #fafbfc;
}

/* 移动端适配 */
@media (max-width: 767px) {
  .wholesale-modal-header {
    padding: 0;
    min-height: 0;

    .header-left {
      .header-text {
        h3 {
          font-size: 15px;
        }

        p {
          font-size: 11px;
        }
      }
    }

  }

  .wholesale-modal-body {
    padding: 16px;
    max-height: calc(100vh - 120px);
  }

  .wholesale-modal-footer {
    padding: 12px 16px;
    flex-direction: row-reverse;

    .el-button {
      flex: 1;
      margin: 0 4px;
    }
  }

  // 表单项全宽显示
  .form-section {
    margin-bottom: 20px;
    padding-bottom: 20px;

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
      margin-bottom: 12px;
      padding-left: 6px !important;
      padding-right: 6px !important;
    }

    // 手机端改为标签在上、输入框在下，方便一行两个字段
    :deep(.el-form-item) {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      margin-bottom: 12px;

      .el-form-item__label {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        line-height: 1.3 !important;
        padding: 0 0 6px !important;
        font-size: 12px;
        white-space: normal;
      }

      .el-form-item__content {
        width: 100%;
        min-width: 0;
        margin-left: 0 !important;
      }
    }

    // 日期选择器全宽
    :deep(.el-date-editor) {
      width: 100% !important;
    }

    // 下拉框全宽
    :deep(.el-select) {
      width: 100% !important;
    }
  }

  // 手机列表优化
  .phones-display {
    .phones-list {
      max-height: 200px;
    }

    .phone-item {
      padding: 12px;

      .phone-main {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 12px;

        .phone-left {
          .phone-detail {
            font-size: 13px;
            line-height: 1.4;
            word-break: break-word;
          }
        }

        .phone-prices {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 10px;
          width: 100%;

          .price-item {
            justify-content: space-between;

            .price-label {
              font-size: 13px;
            }

            .price-input {
              width: 120px !important;
            }

            &.profit-display {
              .price-value {
                min-width: 80px;
                text-align: right;
              }
            }
          }
        }

        .phone-prices-two-col {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px !important;

          .price-item {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            justify-content: flex-start;
            gap: 4px;
            min-width: 0;

            .price-label {
              font-size: 12px;
              line-height: 1.2;
            }

            .price-input {
              width: 100% !important;
            }
          }
        }
      }

      .phone-extra {
        flex-direction: column !important;
        gap: 6px !important;
        padding-left: 0;
        font-size: 11px;

        .phone-supplier,
        .phone-store,
        .phone-inventory-date {
          width: 100%;
          word-break: break-word;
        }
      }
    }
  }

  // 价格汇总优化
  .price-summary {
    flex-direction: column !important;
    gap: 12px !important;
    padding: 12px;

    .summary-item {
      width: 100%;
      justify-content: space-between;
      font-size: 13px;

      &.profit {
        margin-top: 12px;
        padding-top: 12px;
        font-size: 14px;
      }
    }
  }

  // 客户搜索结果优化
  .customer-search-results {
    max-height: 180px;

    .customer-item {
      padding: 12px;

      .customer-info {
        .customer-name {
          font-size: 13px;
        }

        .customer-phone {
          font-size: 11px;
        }
      }
    }
  }

  // 备注文本框优化
  :deep(.el-textarea__inner) {
    font-size: 14px;
  }

  // 警告提示优化
  :deep(.el-alert) {
    .el-alert__content {
      font-size: 12px;
    }
  }
}

/* 超小屏幕适配 */
@media (max-width: 375px) {
  .wholesale-modal-body {
    padding: 12px;
  }

  .form-section {
    :deep(.el-col) {
      margin-bottom: 10px;
    }

    :deep(.el-form-item__label) {
      font-size: 12px;
    }
  }

  .phone-main .phone-left .phone-index {
    width: 20px;
    height: 20px;
    font-size: 11px;
  }
}
</style>
