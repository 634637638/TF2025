<template>
  <MobileDialog
    v-model="dialogVisible"
    :title="modalTitle"
    width="800px"
    :close-on-click-modal="false"
    dialog-class="preorder-dialog preorder-form-dialog"
    :show-default-footer="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      class="preorder-form"
    >
      <!-- 手机号 + 店铺 -->
      <el-row :gutter="20">
        <el-col
          v-if="canViewPreorderField('customer_phone')"
          :span="12"
        >
          <el-form-item
            label="手机号"
            prop="customer_phone"
          >
            <div class="customer-search-container">
              <el-input
                v-model="formData.customer_phone"
                type="tel"
                placeholder="请输入手机号"
                maxlength="11"
                :disabled="isEditMode"
                @input="handleCustomerInput"
                @keyup.enter="handleCustomerEnter"
                @focus="showCustomerSearch = true"
              />
              <CustomerSearchDropdown
                :items="customerSearchResults"
                :loading="customerSearching"
                :visible="!isEditMode && showCustomerSearch && !selectedCustomer"
                :keyword="formData.customer_phone"
                :min-query-length="3"
                @select="selectCustomer"
                @create="prepareNewCustomer"
              />
            </div>
          </el-form-item>
        </el-col>

        <el-col
          v-if="canViewPreorderField('store_name')"
          :span="12"
        >
          <el-form-item
            label="预定店铺"
            prop="store_id"
          >
            <el-select
              v-model="formData.store_id"
              placeholder="请选择店铺"
              class="w-full"
              filterable
              clearable
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

      <!-- 姓名 -->
      <el-form-item
        v-if="canViewPreorderField('customer_name')"
        label="姓名"
        prop="customer_name"
      >
        <el-input
          ref="customerNameInputRef"
          v-model="formData.customer_name"
          placeholder="请输入客户姓名"
          :disabled="isEditMode || !!selectedCustomer"
          maxlength="20"
          show-word-limit
          @input="handleNameInput"
        >
          <template
            v-if="selectedCustomer"
            #suffix
          >
            <el-tag
              type="success"
              size="small"
            >
              已选择客户
            </el-tag>
          </template>
        </el-input>
        <div
          v-if="selectedCustomer && !isEditMode"
          class="text-secondary text-xs"
        >
          已选择：{{ selectedCustomer.name }} ({{ selectedCustomer.phone }})
          <el-link
            type="danger"
            class="ml-2"
            @click="clearSelectedCustomer"
          >
            清除
          </el-link>
        </div>
        <div
          v-else-if="!isEditMode && formData.customer_phone.length >= 3 && customerSearchResults.length === 0 && !customerSearching"
          class="text-success text-xs"
        >
          <i class="fas fa-user-plus" />
          输入姓名后将自动创建新客户
        </div>
      </el-form-item>

      <!-- 品牌 + 型号 -->
      <el-row :gutter="20">
        <el-col
          v-if="canViewPreorderField('brand_name')"
          :span="12"
        >
          <el-form-item
            label="品牌"
            prop="brand_id"
          >
            <el-select
              v-model="formData.brand_id"
              placeholder="请选择品牌"
              class="w-full"
              filterable
              clearable
              @change="handleBrandChange"
            >
              <el-option
                v-for="brand in brands"
                :key="brand.id"
                :label="brand.name"
                :value="brand.id"
              />
            </el-select>
          </el-form-item>
        </el-col>

        <el-col
          v-if="canViewPreorderField('model_name')"
          :span="12"
        >
          <el-form-item
            label="型号"
            prop="model_id"
          >
            <el-select
              ref="modelSelectRef"
              v-model="formData.model_id"
              placeholder="请选择型号"
              class="w-full"
              filterable
              :disabled="!formData.brand_id"
              clearable
              @change="handleModelChange"
            >
              <el-option
                v-for="model in filteredModels"
                :key="model.id"
                :label="model.name"
                :value="model.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 颜色 + 内存 -->
      <el-row :gutter="20">
        <el-col
          v-if="canViewPreorderField('color_name')"
          :span="12"
        >
          <el-form-item
            label="颜色"
            prop="color_id"
          >
            <el-select
              v-model="formData.color_id"
              placeholder="请选择颜色"
              class="w-full"
              filterable
              clearable
            >
              <el-option
                v-for="color in colors"
                :key="color.id"
                :label="color.name"
                :value="color.id"
              />
            </el-select>
          </el-form-item>
        </el-col>

        <el-col
          v-if="canViewPreorderField('memory_size')"
          :span="12"
        >
          <el-form-item
            label="内存"
            prop="memory_id"
          >
            <el-select
              v-model="formData.memory_id"
              placeholder="请选择内存"
              class="w-full"
              filterable
              clearable
            >
              <el-option
                v-for="memory in memories"
                :key="memory.id"
                :label="memory.size"
                :value="memory.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 机况 + 预定时间/预计到货 -->
      <el-row :gutter="20">
        <el-col
          v-if="canViewPreorderField('is_new')"
          :span="12"
        >
          <el-form-item
            label="机况"
            prop="is_new"
          >
            <el-select
              v-model="formData.is_new"
              placeholder="请选择机况"
              class="w-full"
            >
              <el-option
                label="全新"
                :value="1"
              />
              <el-option
                label="二手"
                :value="0"
              />
            </el-select>
          </el-form-item>
        </el-col>

        <el-col
          v-if="canViewPreorderField('expected_arrival')"
          :span="12"
        >
          <el-form-item label="预计到货">
            <el-date-picker
              v-model="formData.expected_arrival"
              type="date"
              placeholder="选择预计到货日期"
              class="w-full"
              :disabled-date="disabledDate"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 售价 + 定金金额 -->
      <el-row :gutter="20">
        <el-col
          v-if="canViewPreorderField('total_price')"
          :span="12"
        >
          <el-form-item label="销售价格">
            <el-input-number
              v-model="formData.total_price"
              :min="0"
              :precision="2"
              placeholder="销售价格"
              class="w-full"
              :controls="false"
            />
          </el-form-item>
        </el-col>

        <el-col
          v-if="canViewPreorderField('deposit_amount')"
          :span="12"
        >
          <el-form-item
            label="定金金额"
            prop="deposit_amount"
          >
            <el-input-number
              v-model="formData.deposit_amount"
              :min="0"
              :precision="2"
              placeholder="定金金额"
              class="w-full"
              :controls="false"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 尾款显示 + 备注 -->
      <el-row :gutter="20">
        <el-col
          v-if="canShowRemainingAmount"
          :span="12"
        >
          <el-form-item label="尾款">
            <div class="remaining-amount-display">
              <span class="amount-value">¥{{ remainingAmount }}</span>
            </div>
          </el-form-item>
        </el-col>

        <el-col
          v-if="canViewPreorderField('remarks')"
          :span="12"
        >
          <el-form-item label="备注">
            <el-input
              v-model="formData.remarks"
              placeholder="请输入备注信息"
              :type="isEditMode ? 'textarea' : 'text'"
              :rows="isEditMode ? 3 : undefined"
            />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <el-button
        type="default"
        @click="handleClose"
      >
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="!canSubmitVisibleFields"
        @click="handleSubmit"
      >
        {{ isEditMode ? '保存' : '创建预定单' }}
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import { isValidMobilePhone, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { preorderApi, Preorder } from '@/api/preorder'
import type { CreatePreorderParams } from '@/api/preorder'
import {
  canViewPreorderField,
  pickVisiblePreorderFields,
  type PreorderFieldName
} from '../preorder-field-permissions'
import { unifiedApi } from '@/utils/unified-api'
import { sortOptionsByOrder } from '@/utils/option-sort'
import CustomerSearchDropdown from '@/components/common/CustomerSearchDropdown.vue'
import { logger } from '@/utils/logger'
import type { ModalProps, SuccessEmits, UpdateVisibleEmits } from '@/types'

interface Props extends ModalProps {
  mode?: 'create' | 'edit'
  preorder?: Preorder | null
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  preorder: null
})
const emit = defineEmits<UpdateVisibleEmits & SuccessEmits>()

const isEditMode = computed(() => props.mode === 'edit')
const modalTitle = computed(() => isEditMode.value ? '编辑预定单' : '新建预定单')

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const formRef = ref<FormInstance>()
const modelSelectRef = ref()
const customerNameInputRef = ref()
const submitting = ref(false)
const customerSearching = ref(false)
const showCustomerSearch = ref(false)

const customerSearchResults = ref<any[]>([])
const selectedCustomer = ref<any>(null)
const customerSearchTimeout = ref<number | null>(null)
const latestSearchKeyword = ref('')
const baseDataLoaded = ref(false)

const extractCustomerList = (payload: any) => {
  const candidates = [
    payload?.customers,
    payload?.records,
    payload?.data?.customers,
    payload?.data?.records,
    payload?.data,
    payload
  ]

  const matched = candidates.find(item => Array.isArray(item))
  return Array.isArray(matched) ? matched : []
}

const extractCustomerId = (payload: any) => {
  return payload?.id ?? payload?.data?.id ?? payload?.customer?.id ?? null
}

const handleWindowClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.customer-search-container')) {
    showCustomerSearch.value = false
  }
}

// 下拉数据
const stores = ref<any[]>([])
const brands = ref<any[]>([])
const models = ref<any[]>([])
const colors = ref<any[]>([])
const memories = ref<any[]>([])

const formData = reactive<any>({
  customer_id: null,
  customer_phone: '',
  customer_name: '',
  store_id: null,
  brand_id: null,
  model_id: null,
  color_id: null,
  memory_id: null,
  is_new: 1,
  expected_arrival: null as string | null,
  total_price: null,
  deposit_amount: null,
  remarks: ''
})

const normalizeCustomerPhone = (phone: unknown) => normalizePhoneDigits(phone)

const requiredCreateFields: PreorderFieldName[] = [
  'customer_name',
  'customer_phone',
  'brand_name',
  'model_name',
  'color_name',
  'memory_size',
  'is_new',
  'deposit_amount'
]

const canSubmitVisibleFields = computed(() => (
  isEditMode.value || requiredCreateFields.every(canViewPreorderField)
))

const canShowRemainingAmount = computed(() => (
  canViewPreorderField('remaining_amount') &&
  canViewPreorderField('total_price') &&
  canViewPreorderField('deposit_amount')
))

const formRules = {
  customer_phone: [
    ValidationRules.required('请输入手机号'),
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (isEditMode.value || selectedCustomer.value) {
          callback()
          return
        }
        if (!value) {
          callback(new Error('请输入手机号'))
        } else if (!isValidMobilePhone(value)) {
          callback(new Error('请输入有效的11位手机号'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  customer_name: [
    ValidationRules.required('请输入客户姓名'),
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (isEditMode.value || selectedCustomer.value) {
          callback()
          return
        }
        if (!value || !value.trim()) {
          callback(new Error('请输入客户姓名'))
        } else if (!/^[\u4e00-\u9fa5a-zA-Z\s]{2,20}$/.test(value.trim())) {
          callback(new Error('姓名只能包含中文、英文，长度2-20个字符'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  store_id: [ValidationRules.required('请选择店铺')],
  brand_id: [ValidationRules.required('请选择品牌')],
  model_id: [ValidationRules.required('请选择型号')],
  color_id: [ValidationRules.required('请选择颜色')],
  memory_id: [ValidationRules.required('请选择内存')],
  deposit_amount: [
    ValidationRules.required('请输入定金金额'),
    {
      validator: (_rule: any, value: any, callback: any) => {
        const num = Number(value)
        if (value && (isNaN(num) || num <= 0)) {
          callback(new Error('定金金额必须大于0'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 过滤后的型号列表
const filteredModels = computed(() => {
  if (!formData.brand_id) return []
  return models.value.filter(m => Number(m.brand_id) === Number(formData.brand_id))
})

// 计算尾款
const remainingAmount = computed(() => {
  const price = Number(formData.total_price) || 0
  const deposit = Number(formData.deposit_amount) || 0

  if (!price) return '请先输入销售价格'
  if (!formData.deposit_amount || deposit === 0) return '请输入定金金额'

  const remaining = price - deposit
  return Number.isInteger(remaining) ? remaining.toString() : remaining.toFixed(2)
})

// 预计到货日期不能早于今天。
const disabledDate = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

const formatDateOnly = (value: unknown) => {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value as string | number | Date)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 加载基础数据
const loadBaseData = async () => {
  if (baseDataLoaded.value) {
    return
  }

  try {
    const options = await preorderApi.getPreorderOptions()
    const storesData = Array.isArray(options?.stores) ? options.stores : []
    const brandsData = Array.isArray(options?.brands) ? options.brands : []
    const modelsData = Array.isArray(options?.models) ? options.models : []
    const colorsData = Array.isArray(options?.colors) ? options.colors : []
    const memoriesData = Array.isArray(options?.memories) ? options.memories : []

    stores.value = sortOptionsByOrder(storesData)
    brands.value = sortOptionsByOrder(brandsData)
    models.value = sortOptionsByOrder(Array.isArray(modelsData) ? modelsData : [])
    colors.value = sortOptionsByOrder(Array.isArray(colorsData) ? colorsData : [])
    memories.value = sortOptionsByOrder(Array.isArray(memoriesData) ? memoriesData : [], { labelKeys: ['size', 'capacity', 'name'] })
    baseDataLoaded.value = true
  } catch (err) {
    logger.error('加载基础数据失败:', err)
    stores.value = []
    brands.value = []
    models.value = []
    colors.value = []
    memories.value = []
    ElMessage.error('预订单选项加载失败，请刷新后重试')
  }
}

// 品牌变更
const handleBrandChange = () => {
  formData.model_id = null
  nextTick(() => {
    modelSelectRef.value?.focus()
  })
}

// 型号变更
const handleModelChange = () => {
  // 颜色和内存不需要联动清空
}

// 客户输入处理
const handleCustomerInput = (value: string) => {
  if (isEditMode.value) return

  const cleanedValue = normalizeCustomerPhone(value)
  formData.customer_phone = cleanedValue

  if (customerSearchTimeout.value) {
    clearTimeout(customerSearchTimeout.value)
  }

  customerSearchResults.value = []

  if (!cleanedValue) {
    selectedCustomer.value = null
    return
  }

  if (selectedCustomer.value && normalizeCustomerPhone(selectedCustomer.value.phone) !== cleanedValue) {
    selectedCustomer.value = null
    formData.customer_id = null
  }

  if (cleanedValue.length >= 3) {
    customerSearchTimeout.value = window.setTimeout(() => {
      searchCustomers(cleanedValue)
    }, 300)
  }
}

// 姓名输入处理
const handleNameInput = (value: string) => {
  if (isEditMode.value) return
  formData.customer_name = normalizePersonName(value, 20)
}

// 客户回车搜索
const handleCustomerEnter = () => {
  if (isEditMode.value) return
  if (formData.customer_phone.length >= 3) {
    searchCustomers(formData.customer_phone)
  }
}

// 搜索客户
const searchCustomers = async (keyword: string) => {
  if (!keyword || keyword.length < 3) return

  latestSearchKeyword.value = keyword
  customerSearching.value = true
  try {
    const response = await unifiedApi.get('/customers', {
      params: { search: keyword, page_size: 10, status: '' }
    })

    const records = extractCustomerList(response.data)
    if (latestSearchKeyword.value === keyword) {
      customerSearchResults.value = records
    }
  } catch (err) {
    logger.error('搜索客户失败:', err)
    if (latestSearchKeyword.value === keyword) {
      customerSearchResults.value = []
    }
  } finally {
    if (latestSearchKeyword.value === keyword) {
      customerSearching.value = false
    }
  }
}

// 选择客户
const selectCustomer = (customer: any) => {
  if (isEditMode.value) return

  selectedCustomer.value = customer
  formData.customer_id = customer.id
  formData.customer_name = normalizePersonName(customer.name, 20)
  formData.customer_phone = normalizeCustomerPhone(customer.phone)
  showCustomerSearch.value = false
  customerSearchResults.value = []

  nextTick(() => {
    formRef.value?.clearValidate('customer_phone')
    formRef.value?.clearValidate('customer_name')
  })
}

const prepareNewCustomer = () => {
  showCustomerSearch.value = false
  nextTick(() => customerNameInputRef.value?.focus())
}

// 清除选择的客户
const clearSelectedCustomer = () => {
  if (isEditMode.value) return

  selectedCustomer.value = null
  formData.customer_id = null
  formData.customer_name = ''
  formData.customer_phone = ''
  showCustomerSearch.value = false
  customerSearchResults.value = []
}

// 重置表单
const resetForm = () => {
  if (customerSearchTimeout.value) {
    clearTimeout(customerSearchTimeout.value)
    customerSearchTimeout.value = null
  }
  latestSearchKeyword.value = ''

  Object.assign(formData, {
    customer_id: null,
    customer_phone: '',
    customer_name: '',
    store_id: null,
    brand_id: null,
    model_id: null,
    color_id: null,
    memory_id: null,
    is_new: 1,
    expected_arrival: null,
    total_price: null,
    deposit_amount: null,
    remarks: ''
  })
  selectedCustomer.value = null
  customerSearchResults.value = []
  showCustomerSearch.value = false
}

// 填充编辑数据
const fillFormData = (preorder: Preorder) => {
  Object.assign(formData, {
    store_id: preorder.store_id || null,
    customer_id: preorder.customer_id || null,
    customer_name: normalizePersonName(preorder.customer_name || '', 20),
    customer_phone: normalizeCustomerPhone(preorder.customer_phone || ''),
    brand_id: preorder.brand_id || null,
    model_id: preorder.model_id || null,
    color_id: preorder.color_id || null,
    memory_id: preorder.memory_id || null,
    is_new: preorder.is_new !== undefined ? preorder.is_new : 1,
    total_price: Number(preorder.total_price ?? 0),
    deposit_amount: Number(preorder.deposit_amount ?? 0),
    expected_arrival: preorder.expected_arrival || preorder.arrival_date || null,
    remarks: preorder.remarks || ''
  })
}

// 提交表单
const handleSubmit = async () => {
  if (submitting.value) return
  if (!formRef.value) return
  if (!canSubmitVisibleFields.value) {
    ElMessage.error('当前字段权限不足，无法提交预定所需字段')
    return
  }

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    if (isEditMode.value) {
      await handleEditSubmit()
    } else {
      await handleCreateSubmit()
    }
    emit('success')
    handleClose()
  } catch (err: any) {
    logger.error('提交失败:', err)
    ElMessage.error(err.response?.data?.message || err.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

// 创建预定单
const handleCreateSubmit = async () => {
  let customerId = formData.customer_id
  const normalizedCustomerPhone = normalizeCustomerPhone(formData.customer_phone)
  const normalizedCustomerName = normalizePersonName(formData.customer_name, 20)

  formData.customer_name = normalizedCustomerName

  if (!selectedCustomer.value && normalizedCustomerName && normalizedCustomerPhone) {
    if (!isValidMobilePhone(normalizedCustomerPhone)) {
      throw new Error('请输入有效的手机号码')
    }

    const customerResponse = await unifiedApi.post('/customers', {
      name: normalizedCustomerName,
      phone: normalizedCustomerPhone
    })
    customerId = extractCustomerId(customerResponse.data)
  } else if (selectedCustomer.value) {
    customerId = formData.customer_id
  }

  if (!customerId) {
    throw new Error('客户信息保存失败')
  }

  const payload = pickVisiblePreorderFields({
    customer_id: customerId,
    store_id: formData.store_id,
    brand_id: formData.brand_id,
    model_id: formData.model_id,
    color_id: formData.color_id,
    memory_id: formData.memory_id,
    is_new: formData.is_new,
    total_price: formData.total_price,
    deposit_amount: formData.deposit_amount,
    expected_arrival: formatDateOnly(formData.expected_arrival),
    remarks: formData.remarks
  }, {
    customer_id: 'customer_name',
    store_id: 'store_name',
    brand_id: 'brand_name',
    model_id: 'model_name',
    color_id: 'color_name',
    memory_id: 'memory_size',
    is_new: 'is_new',
    total_price: 'total_price',
    deposit_amount: 'deposit_amount',
    expected_arrival: 'expected_arrival',
    remarks: 'remarks'
  })

  await preorderApi.createPreorder(payload as CreatePreorderParams)
}

// 编辑预定单
const handleEditSubmit = async () => {
  if (!props.preorder) return

  let customerId = formData.customer_id
  const normalizedCustomerPhone = normalizeCustomerPhone(formData.customer_phone)
  const normalizedCustomerName = normalizePersonName(formData.customer_name, 20)

  formData.customer_name = normalizedCustomerName

  if (canViewPreorderField('customer_name') && canViewPreorderField('customer_phone') &&
      ((normalizedCustomerName && normalizedCustomerName !== normalizePersonName(props.preorder?.customer_name || '', 20)) ||
      (normalizedCustomerPhone && normalizedCustomerPhone !== normalizeCustomerPhone(props.preorder?.customer_phone)))) {
    if (normalizedCustomerPhone) {
      if (!isValidMobilePhone(normalizedCustomerPhone)) {
        throw new Error('请输入有效的手机号码')
      }

      const searchRes = await unifiedApi.get('/customers', {
        params: { search: normalizedCustomerPhone, page_size: 1 }
      })
      const customers = extractCustomerList(searchRes.data)
      const existingCustomer = customers.find((c: any) => normalizeCustomerPhone(c.phone) === normalizedCustomerPhone)

      if (existingCustomer) {
        customerId = existingCustomer.id
        if (normalizePersonName(existingCustomer.name, 20) !== normalizedCustomerName) {
          await unifiedApi.put(`/customers/${customerId}`, { name: normalizedCustomerName })
        }
      } else if (normalizedCustomerName) {
        const newCustomerRes = await unifiedApi.post('/customers', {
          name: normalizedCustomerName,
          phone: normalizedCustomerPhone
        })
        customerId = extractCustomerId(newCustomerRes.data)
      }
    }
  }

  if (!customerId) {
    throw new Error('客户信息保存失败')
  }

  const payload = pickVisiblePreorderFields({
    customer_id: customerId,
    store_id: formData.store_id,
    brand_id: formData.brand_id,
    model_id: formData.model_id,
    color_id: formData.color_id,
    memory_id: formData.memory_id,
    is_new: formData.is_new,
    total_price: formData.total_price,
    deposit_amount: formData.deposit_amount,
    expected_arrival: formatDateOnly(formData.expected_arrival),
    remarks: formData.remarks
  }, {
    customer_id: 'customer_name',
    store_id: 'store_name',
    brand_id: 'brand_name',
    model_id: 'model_name',
    color_id: 'color_name',
    memory_id: 'memory_size',
    is_new: 'is_new',
    total_price: 'total_price',
    deposit_amount: 'deposit_amount',
    expected_arrival: 'expected_arrival',
    remarks: 'remarks'
  })

  await preorderApi.updatePreorder(props.preorder.id, payload)
}

// 关闭对话框
const handleClose = () => {
  formRef.value?.resetFields()
  resetForm()
  dialogVisible.value = false
}

// 监听对话框打开
watch(() => props.visible, (visible) => {
  if (visible) {
    loadBaseData()
    if (isEditMode.value && props.preorder) {
      fillFormData(props.preorder)
    } else {
      resetForm()
    }
    return
  }

  resetForm()
}, { immediate: true })

// 监听预定单数据变化
watch(() => props.preorder, (preorder) => {
  if (isEditMode.value && preorder && props.visible) {
    fillFormData(preorder)
  }
}, { immediate: true })

onMounted(() => {
  window.addEventListener('click', handleWindowClick)
})

onBeforeUnmount(() => {
  if (customerSearchTimeout.value) {
    clearTimeout(customerSearchTimeout.value)
    customerSearchTimeout.value = null
  }
  window.removeEventListener('click', handleWindowClick)
})
</script>

<style scoped lang="scss">
:deep(.preorder-form-dialog .el-dialog__body) {
  padding-top: 20px;
}

.preorder-form {
  :deep(.el-row) {
    margin-bottom: 0;
  }

  :deep(.el-col) {
    padding: 0;
  }
}

.customer-search-container {
  position: relative;
  width: 100%;

  .customer-search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 250px;
    overflow-y: auto;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    z-index: 1000;
    margin-top: 4px;

    .search-loading {
      padding: 12px 16px;
      text-align: center;
      color: var(--color-info);
      font-size: 14px;
    }

    .customer-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--tf-color-gray-200);
      transition: background 0.2s;

      &:hover {
        background: var(--tf-color-surface);
      }

      &:last-child {
        border-bottom: none;
      }

      .customer-info {
        flex: 1;

        .customer-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-primary);
          margin-bottom: 4px;
        }

        .customer-phone {
          font-size: 12px;
          color: var(--color-info);
        }
      }

      .customer-select {
        color: var(--color-success);
        font-size: 16px;
      }
    }

    .no-customer-hint {
      padding: 12px 16px;
      text-align: center;
      color: var(--color-info);
      font-size: 13px;

      i {
        margin-right: 4px;
      }
    }
  }
}

.remaining-amount-display {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 11px;
  background: var(--tf-color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-regular);

  .amount-value {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-primary);
  }
}

// 手机端优化
@media (max-width: 768px) {
  :deep(.preorder-form-dialog) {
    .el-dialog__header {
      padding: 12px 16px;
    }

    .el-dialog__body {
      padding: 12px 16px;
      max-height: calc(100vh - 140px);
      overflow-y: auto;
    }

    .el-dialog__footer {
      padding: 10px 16px;
      display: flex;
      gap: 8px;

      .el-button {
        flex: 1;
        margin: 0;
      }
    }
  }

  .preorder-form {
    :deep(.el-form-item) {
      margin-bottom: 16px;

      .el-form-item__label {
        font-size: 13px;
        padding-bottom: 4px;
      }

      .el-input__inner,
      .el-select .el-input__inner,
      .el-textarea__inner {
        font-size: 14px;
      }
    }

    :deep(.el-row) {
      .el-col {
        &:not(:last-child) {
          margin-bottom: 16px;
        }
      }
    }
  }

  .customer-search-container {
    .customer-search-results {
      max-height: 200px;

      .customer-item {
        padding: 10px 12px;

        .customer-info {
          .customer-name {
            font-size: 13px;
          }

          .customer-phone {
            font-size: 11px;
          }
        }
      }

      .no-customer-hint {
        padding: 10px 12px;
        font-size: 12px;
      }
    }
  }

  .remaining-amount-display {
    height: 36px;
    font-size: 13px;

    .amount-value {
      font-size: 15px;
    }
  }
}
</style>
