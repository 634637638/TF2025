<template>
  <MobileDialog
    v-model="dialogVisible"
    title="编辑设备信息"
    :force-fullscreen="isMobile"
    :show-default-footer="false"
    :loading="submitting"
    :close-on-click-modal="false"
    width="800px"
    destroy-on-close
    dialog-class="query-edit-dialog"
    @closed="handleClosed"
  >
    <template #footer>
      <div class="dialog-footer">
        <el-button type="default" @click="dialogVisible = false" :disabled="submitting">
          <i class="fas fa-times"></i>
          取消
        </el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          <i :class="submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'"></i>
          {{ submitting ? '保存中...' : '保存更改' }}
        </el-button>
      </div>
    </template>

    <div v-if="initializing" class="dialog-loading">
      <el-skeleton animated :rows="10" />
    </div>

    <el-form
      v-else
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-position="top"
      class="edit-form-content"
    >
      <div class="form-section">
        <div class="section-title">
          <i class="fas fa-mobile-alt"></i>
          设备信息
        </div>

        <!-- 品牌、型号、颜色、内存 一行展示 -->
        <div class="form-row form-row-4">
          <el-form-item label="品牌" prop="brand">
            <el-select
              v-model="formData.brand"
              placeholder="请选择"
              filterable
              teleported
              popper-class="query-edit-dialog-popper"
              @change="handleBrandChange"
            >
              <el-option
                v-for="brand in options.brands"
                :key="brand"
                :label="brand"
                :value="brand"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="型号" prop="model">
            <el-select
              v-model="formData.model"
              placeholder="请选择"
              filterable
              teleported
              popper-class="query-edit-dialog-popper"
              :disabled="!formData.brand || availableModels.length === 0"
              @change="handleModelChange"
            >
              <el-option
                v-for="model in availableModels"
                :key="`${model.id}-${model.name}`"
                :label="model.name"
                :value="model.name"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="颜色" prop="color">
            <el-select
              v-model="formData.color"
              placeholder="请选择"
              filterable
              teleported
              popper-class="query-edit-dialog-popper"
              @change="handleColorChange"
            >
              <el-option
                v-for="color in options.colors"
                :key="color"
                :label="color"
                :value="color"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="内存" prop="memory">
            <el-select
              v-model="formData.memory"
              placeholder="请选择"
              filterable
              teleported
              popper-class="query-edit-dialog-popper"
              @change="handleMemoryChange"
            >
              <el-option
                v-for="memory in options.memories"
                :key="memory"
                :label="memory"
                :value="memory"
              />
            </el-select>
          </el-form-item>
        </div>

        <!-- 序列号、IMEI、机况 一行展示 -->
        <div class="form-row form-row-3">
          <el-form-item label="序列号" prop="serial_number">
            <el-input
              v-model="formData.serial_number"
              placeholder="请输入序列号"
              maxlength="18"
              clearable
              @input="formatSerialNumber"
            >
              <template #suffix>
                <i class="fas fa-hashtag"></i>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="IMEI" prop="imei">
            <div class="imei-input-wrapper" @dblclick="toggleNoIMEIMode">
              <el-input
                v-model="formData.imei"
                :placeholder="formData.isNoIMEIMode ? '已启用无IMEI模式' : '请输入15位IMEI号'"
                :maxlength="formData.isNoIMEIMode ? 30 : 15"
                clearable
                @input="formatImei"
              >
                <template #suffix>
                  <span v-if="formData.isNoIMEIMode" class="imei-badge">
                    <i class="fas fa-check-circle"></i>
                    无IMEI
                  </span>
                  <i v-else class="fas fa-barcode"></i>
                </template>
              </el-input>
            </div>
          </el-form-item>

          <el-form-item label="机况" prop="is_new">
            <el-select
              v-model="formData.is_new"
              placeholder="请选择"
              teleported
              popper-class="query-edit-dialog-popper"
            >
              <el-option label="全新" value="1" />
              <el-option label="二手" value="0" />
            </el-select>
          </el-form-item>
        </div>

        <div class="form-row form-row-4">
          <el-form-item label="供应商" prop="supplier_id">
            <el-select
              v-model="formData.supplier_id"
              placeholder="请选择供应商"
              filterable
              clearable
              teleported
              popper-class="query-edit-dialog-popper"
            >
              <el-option
                v-for="supplier in options.suppliers"
                :key="supplier.id"
                :label="supplier.name"
                :value="supplier.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="店铺" prop="store_id">
            <el-select
              v-model="formData.store_id"
              placeholder="请选择店铺"
              filterable
              clearable
              teleported
              popper-class="query-edit-dialog-popper"
            >
              <el-option
                v-for="store in options.stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="入库价格" prop="purchase_price">
            <el-input
              :model-value="formatPriceInputValue(formData.purchase_price)"
              placeholder="请输入入库价格"
              inputmode="numeric"
              clearable
              @input="handlePriceInput('purchase_price', $event)"
            >
              <template #prefix>¥</template>
            </el-input>
          </el-form-item>

          <el-form-item label="销售价格" prop="sale_price">
            <el-input
              :model-value="formatPriceInputValue(formData.sale_price)"
              placeholder="请输入销售价格"
              inputmode="numeric"
              clearable
              @input="handlePriceInput('sale_price', $event)"
            >
              <template #prefix>¥</template>
            </el-input>
            <div v-if="showProfit" class="profit-hint">
              利润: <span class="profit-value">¥{{ profit }}</span>
            </div>
          </el-form-item>
        </div>
      </div>

      <div class="form-section">
        <div class="section-title">
          <i class="fas fa-user"></i>
          客户信息
        </div>

        <div class="form-row form-row-3">
          <el-form-item label="客户手机" class="mobile-span-2">
            <div class="customer-search-container">
              <el-input
                v-model="formData.customer_phone"
                placeholder="请输入手机号搜索客户"
                maxlength="11"
                clearable
                @input="handleCustomerPhoneInput"
                @focus="editShowCustomerSearchResults = true"
                @blur="handleCustomerPhoneBlur"
                @clear="handleCustomerClear"
              >
                <template #prefix>
                  <i class="fas fa-phone"></i>
                </template>
              </el-input>

              <div
                v-if="editShowCustomerSearchResults && (editCustomerOptions.length > 0 || editCustomerLookupLoading || (formData.customer_phone.length >= 11 && !editFoundCustomer && !editCustomerLookupLoading))"
                class="customer-search-results"
              >
                <div v-if="editCustomerLookupLoading" class="search-loading">
                  <i class="fas fa-spinner fa-spin"></i>
                  搜索中...
                </div>
                <template v-else>
                  <div
                    v-for="customer in editCustomerOptions"
                    :key="customer.id"
                    class="customer-item"
                    @mousedown.prevent="selectCustomer(customer)"
                  >
                    <div class="customer-info">
                      <div class="customer-name">{{ customer.name }}</div>
                      <div class="customer-phone">{{ customer.phone }}</div>
                      <div v-if="customer.member_number" class="customer-meta">
                        <span class="member-number">{{ customer.member_number }}</span>
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="formData.customer_phone.length >= 11 && editCustomerOptions.length === 0 && !editFoundCustomer"
                    class="create-new-customer"
                    @mousedown.prevent="createNewCustomer"
                  >
                    <i class="fas fa-user-plus"></i>
                    创建新客户 ({{ formData.customer_phone }})
                    <div class="create-hint">输入姓名后点击创建</div>
                  </div>
                </template>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="客户姓名">
            <el-input
              v-model="formData.customer_name"
              placeholder="请输入客户姓名"
              clearable
              data-field="customer_name"
              @input="formatCustomerName"
            />
          </el-form-item>

          <el-form-item label="Apple ID">
            <el-input
              v-model="formData.apple_id"
              placeholder="请输入 Apple ID（可选）"
              clearable
              data-field="apple_id"
              @input="formatAppleId"
            >
              <template #suffix>
                <i class="fab fa-apple"></i>
              </template>
            </el-input>
          </el-form-item>
        </div>
      </div>

      <div class="form-section">
        <div class="section-title">
          <i class="fas fa-shopping-cart"></i>
          销售信息
        </div>

        <div class="form-row form-row-3">
          <el-form-item label="入库日期" class="date-picker-item">
            <el-date-picker
              v-model="formData.Inventorytime"
              type="date"
              placeholder="请选择入库日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              popper-class="query-edit-dialog-popper"
            />
          </el-form-item>

          <el-form-item label="销售日期" class="date-picker-item">
            <el-date-picker
              v-model="formData.salestime"
              type="date"
              placeholder="请选择销售日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              popper-class="query-edit-dialog-popper"
            />
          </el-form-item>

          <el-form-item label="入库员">
            <el-input
              :value="formData.purchase_operator_name"
              disabled
              placeholder="当前用户"
            >
              <template #suffix>
                <i class="fas fa-user"></i>
              </template>
            </el-input>
          </el-form-item>
        </div>

        <div class="form-row form-row-4">
          <el-form-item label="销售员">
            <el-select
              v-model="formData.sale_operator_id"
              placeholder="请选择销售员"
              filterable
              clearable
              teleported
              popper-class="query-edit-dialog-popper"
            >
              <el-option
                v-for="user in options.users"
                :key="user.id"
                :label="user.name"
                :value="String(user.id)"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="支付方式">
            <el-select
              v-model="formData.payment_method"
              placeholder="请选择"
              clearable
              teleported
              popper-class="query-edit-dialog-popper"
              @change="handlePaymentMethodChange"
            >
              <el-option label="现金支付" value="cash" />
              <el-option label="移动支付" value="mobile" />
              <el-option label="银行卡" value="bank_card" />
              <el-option label="国补刷卡" value="subsidy_card" />
            </el-select>
          </el-form-item>

          <el-form-item
            v-if="showPaymentChannel"
            label="支付渠道"
          >
            <el-select
              v-model="formData.payment_channel"
              placeholder="请选择"
              clearable
              teleported
              popper-class="query-edit-dialog-popper"
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

          <el-form-item label="状态" prop="status">
            <el-select
              v-model="formData.status"
              placeholder="请选择状态"
              teleported
              popper-class="query-edit-dialog-popper"
            >
              <el-option
                v-for="option in PHONE_STATUS_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="备注" class="mobile-span-2">
          <el-input
            v-model="formData.remarks"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            placeholder="销售备注信息"
            @input="formatRemarks"
          />
        </el-form-item>
      </div>
    </el-form>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import MobileDialog from '@/components/MobileDialog.vue'
import { useMobile } from '@/composables/mobile'
import unifiedApi from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { isValidMobilePhone, normalizeAppleId, normalizePersonName, normalizePhoneDigits, resolveAppleAccountEmail } from '@/utils/security'
import { PHONE_STATUS_OPTIONS } from '@/constants/phoneStatuses'
import type { Customer } from '@/types/order'
import type { IdNameOption, ModelOption, ModelValueProps, SuccessEmits, UpdateModelValueEmits, UserOption } from '@/types'

// ==================== 本地类型定义 ====================

interface EditModalOptions {
  suppliers: IdNameOption[]
  stores: IdNameOption[]
  brands: string[]
  brandItems: IdNameOption[]
  models: ModelOption[]
  colors: string[]
  colorItems: IdNameOption[]
  memories: string[]
  memoryItems: IdNameOption[]
  users: UserOption[]
}

interface OptionItem extends IdNameOption {
  sort_order?: number
}

interface RawLookupItem {
  id?: number | string
  name?: string
  sort_order?: number | string
  size?: string
  capacity?: string
  model?: string
  model_name?: string
  brand_id?: number | string | null
  brand_name?: string
  brand?: string
}

type NormalizedSection = Record<string, string | number | boolean | null | undefined>

// 客户选项扩展 Customer 类型
interface CustomerOption extends Pick<Customer, 'id' | 'name' | 'phone'> {
  apple_id?: string
  member_number?: string
}

const normalizeCustomerOption = (customer?: Partial<CustomerOption> | null): CustomerOption => ({
  id: Number(customer?.id || 0),
  name: normalizePersonName(customer?.name || '', 20),
  phone: normalizeCustomerPhone(customer?.phone || ''),
  apple_id: normalizeAppleId(customer?.apple_id || ''),
  member_number: customer?.member_number || ''
})

interface NormalizedPhoneData {
  基本信息: NormalizedSection
  供应商信息: NormalizedSection
  店铺信息: NormalizedSection
  价格信息: NormalizedSection
  时间信息: NormalizedSection
  客户信息: NormalizedSection
  操作员信息: NormalizedSection
  销售信息: NormalizedSection
}

interface FormData {
  id: number
  imei: string
  serial_number: string
  brand_id: number | null
  model_id: number | null
  color_id: number | null
  memory_id: number | null
  brand: string
  model: string
  color: string
  memory: string
  is_new: string
  status: string
  purchase_price: number
  sale_price: number
  customer_id: string
  customer_phone: string
  customer_name: string
  apple_id: string
  store_id: number | null
  purchase_operator_name: string
  purchase_operator_id: string
  sale_operator_id: string
  supplier_id: number | null
  Inventorytime: string
  salestime: string
  payment_method: string
  payment_channel: string
  isNoIMEIMode: boolean
  remarks: string
}

interface PhoneUpdateRequest {
  brand_id: number
  model_id: number
  color_id: number
  memory_id: number
  brand: string
  model: string
  color: string
  memory: string
  imei: string
  serial_number: string
  condition: string
  supplier_id: number | null
  store_id: number | null
  purchase_price: number
  sale_price: number
  customer_phone: string
  customer_name: string | null
  Inventorytime: string | null
  salestime: string | null
  status: string
  remarks: string
  payment_method: string | null
  payment_channel: string | null
  customer_id?: number | null
  sale_operator_id?: number | null
  purchase_operator_id?: number | null
  apple_id?: string | null
}

type PriceField = 'purchase_price' | 'sale_price'

const EMPTY_OPTIONS: EditModalOptions = {
  suppliers: [],
  stores: [],
  brands: [],
  brandItems: [],
  models: [],
  colors: [],
  colorItems: [],
  memories: [],
  memoryItems: [],
  users: []
}

let cachedOptions: EditModalOptions | null = null
let optionsPromise: Promise<EditModalOptions> | null = null

const cloneOptions = (source: EditModalOptions): EditModalOptions => ({
  suppliers: [...source.suppliers],
  stores: [...source.stores],
  brands: [...source.brands],
  brandItems: [...source.brandItems],
  models: [...source.models],
  colors: [...source.colors],
  colorItems: [...source.colorItems],
  memories: [...source.memories],
  memoryItems: [...source.memoryItems],
  users: [...source.users]
})

const sortByOrder = <T extends { sort_order?: number; id?: number }>(items: T[]) => {
  return [...items].sort((a, b) => {
    const orderDiff = (a.sort_order || 0) - (b.sort_order || 0)
    if (orderDiff !== 0) return orderDiff
    return (a.id || 0) - (b.id || 0)
  })
}

const toRecord = (value: unknown): Record<string, unknown> | null => {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

const extractNestedList = (data: unknown, keys: string[]) => {
  if (Array.isArray(data)) return data
  const record = toRecord(data)
  if (!record) return []

  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[]
    }
  }

  return []
}

const normalizeNameList = (data: unknown, keyCandidates: string[] = ['name']) => {
  const raw = extractNestedList(data, ['data', 'colors', 'memories'])

  return sortByOrder(
    raw
      .map((item) => {
        if (typeof item === 'string') return { id: 0, name: item, sort_order: 0 }
        const rawItem = toRecord(item) as RawLookupItem | null
        const name = keyCandidates.map((key) => rawItem?.[key as keyof RawLookupItem]).find(Boolean)
        return name ? { id: Number(rawItem?.id || 0), name: String(name), sort_order: Number(rawItem?.sort_order || 0) } : null
      })
      .filter(Boolean)
  ).map(item => item.name)
}

const normalizeModels = (data: unknown): ModelOption[] => {
  const raw = extractNestedList(data, ['data', 'models'])

  return sortByOrder(
    raw
      .map((item) => {
        const rawItem = toRecord(item) as RawLookupItem | null
        if (!rawItem) return null
        const name = rawItem.name || rawItem.model || rawItem.model_name
        if (!name) return null
        return {
          id: Number(rawItem.id || 0),
          name,
          brand_id: rawItem.brand_id !== undefined && rawItem.brand_id !== null ? Number(rawItem.brand_id) : null,
          brand_name: rawItem.brand_name || rawItem.brand || '',
          brand: rawItem.brand || '',
          sort_order: Number(rawItem.sort_order || 0)
        }
      })
      .filter(Boolean) as ModelOption[]
  )
}

const normalizeLookupValue = (value?: string | number | null) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
}

const fetchEditOptions = async (): Promise<EditModalOptions> => {
  if (cachedOptions) {
    return cloneOptions(cachedOptions)
  }

  if (!optionsPromise) {
    optionsPromise = (async () => {
      try {
        const [
          suppliersRes,
          storesRes,
          brandsRes,
          modelsRes,
          colorsRes,
          memoriesRes,
          usersRes
        ] = await Promise.all([
          unifiedApi.get('/suppliers?limit=10000'),
          unifiedApi.get('/stores?all=true&limit=10000'),
          unifiedApi.get('/brands?status=1&limit=10000'),
          unifiedApi.get('/models?limit=10000'),
          unifiedApi.get('/colors?limit=10000'),
          unifiedApi.get('/memories?limit=10000'),
          unifiedApi.get('/users/employees?limit=10000')
        ])

        const brandsRaw = extractNestedList(brandsRes?.data, ['data'])

        const options: EditModalOptions = {
          suppliers: suppliersRes.success && Array.isArray(suppliersRes.data)
            ? sortByOrder(
                suppliersRes.data.map((item) => ({
                  id: Number(item.id || 0),
                  name: item.name,
                  sort_order: Number(item.sort_order || 0)
                }))
              )
            : [],
          stores: storesRes.success && Array.isArray(storesRes.data)
            ? sortByOrder(
                storesRes.data.map((item) => ({
                  id: Number(item.id || 0),
                  name: item.name,
                  sort_order: Number(item.sort_order || 0)
                }))
              )
            : [],
          brands: sortByOrder(
            brandsRaw
              .map((item) => {
                const rawItem = toRecord(item) as RawLookupItem | null
                return {
                  id: Number(rawItem?.id || 0),
                  name: String(rawItem?.name || ''),
                  sort_order: Number(rawItem?.sort_order || 0)
                }
              })
              .filter((item) => item.name)
          ).map(item => item.name),
          brandItems: sortByOrder(
            brandsRaw
              .map((item) => {
                const rawItem = toRecord(item) as RawLookupItem | null
                return {
                  id: Number(rawItem?.id || 0),
                  name: String(rawItem?.name || ''),
                  sort_order: Number(rawItem?.sort_order || 0)
                }
              })
              .filter((item) => item.name)
          ),
          models: modelsRes.success ? normalizeModels(modelsRes.data) : [],
          colors: colorsRes.success ? normalizeNameList(colorsRes.data) : [],
          colorItems: colorsRes.success
            ? sortByOrder(
                extractNestedList(colorsRes.data, ['data', 'colors'])
                  .map((item) => {
                    if (typeof item === 'string') return null
                    const rawItem = toRecord(item) as RawLookupItem | null
                    return rawItem?.name
                      ? { id: Number(rawItem.id || 0), name: rawItem.name, sort_order: Number(rawItem.sort_order || 0) }
                      : null
                  })
                  .filter(Boolean) as OptionItem[]
              )
            : [],
          memories: memoriesRes.success ? normalizeNameList(memoriesRes.data, ['size', 'capacity', 'name']) : [],
          memoryItems: memoriesRes.success
            ? sortByOrder(
                extractNestedList(memoriesRes.data, ['data', 'memories'])
                  .map((item) => {
                    if (typeof item === 'string') return null
                    const rawItem = toRecord(item) as RawLookupItem | null
                    const name = rawItem?.size || rawItem?.capacity || rawItem?.name
                    return name
                      ? { id: Number(rawItem.id || 0), name, sort_order: Number(rawItem.sort_order || 0) }
                      : null
                  })
                  .filter(Boolean) as OptionItem[]
              )
            : [],
          users: usersRes.success && Array.isArray(usersRes.data?.employees)
            ? usersRes.data.employees.map((item) => ({
                id: Number(item.id || 0),
                name: item.name
              }))
            : []
        }

        cachedOptions = options
        return cloneOptions(options)
      } catch (error) {
        const fallback: EditModalOptions = {
          suppliers: [],
          stores: [],
          brands: ['Apple', '华为', '小米', 'OPPO', 'vivo', '三星', '荣耀'],
          brandItems: [],
          models: [],
          colors: ['黑色', '白色', '红色', '蓝色', '金色', '银色', '绿色', '紫色'],
          colorItems: [],
          memories: ['64GB', '128GB', '256GB', '512GB', '1TB'],
          memoryItems: [],
          users: []
        }
        cachedOptions = fallback
        return cloneOptions(fallback)
      } finally {
        optionsPromise = null
      }
    })()
  }

  return cloneOptions(await optionsPromise)
}

const normalizePhoneData = (item: unknown): NormalizedPhoneData => {
  const rawItem = toRecord(item)
  const basicSection = toRecord(rawItem?.基本信息) as NormalizedSection | null
  const priceSection = toRecord(rawItem?.价格信息) as NormalizedSection | null
  const timeSection = toRecord(rawItem?.时间信息) as NormalizedSection | null
  const supplierSection = toRecord(rawItem?.供应商信息) as NormalizedSection | null
  const storeSection = toRecord(rawItem?.店铺信息) as NormalizedSection | null
  const customerSection = toRecord(rawItem?.客户信息) as NormalizedSection | null
  const operatorSection = toRecord(rawItem?.操作员信息) as NormalizedSection | null
  const saleSection = toRecord(rawItem?.销售信息) as NormalizedSection | null

  if (basicSection && priceSection && timeSection) {
    const purchasePrice = Number(priceSection.purchase_price || 0)
    const salePrice = Number(priceSection.sale_price || 0)

    return {
      基本信息: {
        ...basicSection,
        phone_id: basicSection.phone_id || basicSection.id || rawItem?.id
      },
      供应商信息: {
        ...(supplierSection || {}),
        supplier_id: supplierSection?.supplier_id ?? null
      },
      店铺信息: {
        ...(storeSection || {}),
        store_id: storeSection?.store_id ?? null
      },
      价格信息: {
        ...(priceSection || {}),
        purchase_price: purchasePrice,
        sale_price: salePrice
      },
      时间信息: timeSection || {},
      客户信息: {
        ...(customerSection || {}),
        customer_id: customerSection?.customer_id ?? null
      },
      操作员信息: {
        ...(operatorSection || {}),
        sale_operator_id: operatorSection?.sale_operator_id ?? operatorSection?.operator_id ?? null,
        inventory_operator_id: operatorSection?.inventory_operator_id ?? null
      },
      销售信息: saleSection || {}
    }
  }

  return {
    基本信息: {
      phone_id: rawItem?.phone_id || rawItem?.id,
      imei: rawItem?.imei as string || '',
      serial_number: rawItem?.serial_number as string || '',
      brand: rawItem?.brand as string || '',
      model: rawItem?.model as string || '',
      color: rawItem?.color as string || '',
      memory: rawItem?.memory as string || '',
      is_new: rawItem?.is_new as string | number | boolean | undefined,
      status_code: rawItem?.status_code as string || rawItem?.status as string || 'in_stock',
      remarks: rawItem?.remarks as string || ''
    },
    供应商信息: {
      supplier_id: rawItem?.supplier_id as number | string | null | undefined ?? null,
      supplier_name: rawItem?.supplier_name as string || ''
    },
    店铺信息: {
      store_id: rawItem?.store_id as number | string | null | undefined ?? null,
      store_name: rawItem?.store_name as string || ''
    },
    价格信息: {
      purchase_price: Number(rawItem?.purchase_price || 0),
      sale_price: Number(rawItem?.sale_price || 0)
    },
    时间信息: {
      Inventorytime: rawItem?.Inventorytime as string || rawItem?.inventorytime as string || rawItem?.created_at as string || '',
      salestime: rawItem?.salestime as string || rawItem?.sale_date as string || ''
    },
    客户信息: {
      customer_id: rawItem?.customer_id as number | string | null | undefined ?? null,
      customer_name: normalizePersonName(rawItem?.customer_name as string || '', 20),
      customer_phone: normalizeCustomerPhone(rawItem?.customer_phone as string || ''),
      apple_id: normalizeAppleId(rawItem?.customer_apple_id as string || rawItem?.apple_id as string || '')
    },
    操作员信息: {
      inventory_operator_id: rawItem?.inventory_operator_id as number | string | null | undefined ?? null,
      inventory_operator_name: rawItem?.inventory_operator_name as string || '',
      purchase_operator_name: rawItem?.purchase_operator_name as string || '',
      sale_operator_id: rawItem?.sale_operator_id as number | string | null | undefined ?? null,
      sale_operator_name: rawItem?.sale_operator_name as string || rawItem?.salesperson_name as string || ''
    },
    销售信息: {
      payment_method: rawItem?.payment_method as string || '',
      payment_channel: rawItem?.payment_channel as string || ''
    }
  }
}

const normalizeDate = (dateString?: string) => {
  if (!dateString) return ''
  return TimeUtil.format(dateString, TIME_FORMATS.DATE)
}

const defaultFormState = (): FormData => ({
  id: 0,
  imei: '',
  serial_number: '',
  brand_id: null,
  model_id: null,
  color_id: null,
  memory_id: null,
  brand: '',
  model: '',
  color: '',
  memory: '',
  is_new: '1',
  status: 'in_stock',
  purchase_price: 0,
  sale_price: 0,
  customer_id: '',
  customer_phone: '',
  customer_name: '',
  apple_id: '',
  store_id: null,
  purchase_operator_name: '',
  purchase_operator_id: '',
  sale_operator_id: '',
  supplier_id: null,
  Inventorytime: '',
  salestime: '',
  payment_method: '',
  payment_channel: '',
  isNoIMEIMode: false,
  remarks: ''
})

const normalizeCustomerPhone = (phone: unknown) => normalizePhoneDigits(phone)

const props = defineProps<ModelValueProps & {
  phoneId: number | null
}>()

const emit = defineEmits<UpdateModelValueEmits & SuccessEmits>()

const { isMobile } = useMobile()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const formRef = ref<FormInstance>()
const initializing = ref(false)
const submitting = ref(false)
const options = reactive<EditModalOptions>(cloneOptions(EMPTY_OPTIONS))
const formData = reactive<FormData>(defaultFormState())
const originalEditValues = ref({
  customer_id: '',
  sale_operator_id: '',
  purchase_operator_id: '',
  apple_id: ''
})
const editCustomerOptions = ref<CustomerOption[]>([])
const editCustomerLookupLoading = ref(false)
const editFoundCustomer = ref<CustomerOption | null>(null)
const editShowCustomerSearchResults = ref(false)
const editCustomerSearchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
let lastLoadToken = 0
let salePriceDebounceTimer: ReturnType<typeof setTimeout> | null = null

const formRules = {
  brand: [ValidationRules.required('请选择品牌')],
  model: [ValidationRules.required('请选择型号')],
  color: [ValidationRules.required('请选择颜色')],
  memory: [ValidationRules.required('请选择内存')],
  serial_number: [ValidationRules.required('请输入序列号')]
}

const normalizeBrand = (brand?: string) => {
  return (brand || '').trim().toLowerCase()
}

const findOptionByName = (items: OptionItem[], name?: string | null) => {
  const normalizedName = normalizeLookupValue(name)
  if (!normalizedName) return null

  return items.find(item => normalizeLookupValue(item.name) === normalizedName) || null
}

const findModelOption = (modelName?: string | null, brandId?: number | null, brandName?: string | null) => {
  const normalizedModelName = normalizeLookupValue(modelName)
  if (!normalizedModelName) return null

  const normalizedBrandName = normalizeBrand(brandName || '')
  const candidates = options.models.filter(model => normalizeLookupValue(model.name) === normalizedModelName)

  if (brandId) {
    const matchedByBrandId = candidates.find(model => Number(model.brand_id) === Number(brandId))
    if (matchedByBrandId) return matchedByBrandId
  }

  if (normalizedBrandName) {
    const matchedByBrandName = candidates.find(model => normalizeBrand(model.brand_name || model.brand || '') === normalizedBrandName)
    if (matchedByBrandName) return matchedByBrandName
  }

  return candidates[0] || null
}

const syncBrandId = () => {
  const matchedBrand = findOptionByName(options.brandItems, formData.brand)
  formData.brand_id = matchedBrand?.id || null
  return matchedBrand
}

const syncModelId = () => {
  const matchedModel = findModelOption(formData.model, formData.brand_id, formData.brand)
  formData.model_id = matchedModel?.id || null
  return matchedModel
}

const syncColorId = () => {
  const matchedColor = findOptionByName(options.colorItems, formData.color)
  formData.color_id = matchedColor?.id || null
  return matchedColor
}

const syncMemoryId = () => {
  const matchedMemory = findOptionByName(options.memoryItems, formData.memory)
  formData.memory_id = matchedMemory?.id || null
  return matchedMemory
}

const syncCatalogSelections = () => {
  syncBrandId()
  syncModelId()
  syncColorId()
  syncMemoryId()
}

const availableModels = computed(() => {
  if (!formData.brand) return []

  const normalizedBrand = normalizeBrand(formData.brand)
  const matched = options.models.filter(model => {
    const brandName = normalizeBrand(model.brand_name || model.brand)
    if (brandName && brandName === normalizedBrand) return true
    if (formData.brand_id && model.brand_id && Number(model.brand_id) === Number(formData.brand_id)) return true
    return false
  })

  const normalizedCurrentModel = normalizeLookupValue(formData.model)
  if (formData.model && !matched.some(model => normalizeLookupValue(model.name) === normalizedCurrentModel)) {
    const currentModel = findModelOption(formData.model, formData.brand_id, formData.brand)
    matched.unshift({
      id: currentModel?.id || formData.model_id || -1,
      name: formData.model,
      brand_id: currentModel?.brand_id ?? formData.brand_id,
      brand_name: currentModel?.brand_name || formData.brand
    })
  }

  const seen = new Set<string>()
  return matched.filter(model => {
    const key = `${model.brand_id || 0}:${normalizeLookupValue(model.name)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})

const profit = computed(() => {
  if (!formData.purchase_price || !formData.sale_price) return 0
  return formData.sale_price - formData.purchase_price
})

const showProfit = computed(() => {
  return (formData.purchase_price || 0) > 0 && (formData.sale_price || 0) > 0
})

const showPaymentChannel = computed(() => {
  return ['mobile', 'bank_card', 'subsidy_card'].includes(formData.payment_method)
})

const resetFormState = () => {
  Object.assign(formData, defaultFormState())
  Object.assign(options, cloneOptions(cachedOptions || EMPTY_OPTIONS))
  originalEditValues.value = {
    customer_id: '',
    sale_operator_id: '',
    purchase_operator_id: '',
    apple_id: ''
  }
  editCustomerOptions.value = []
  editFoundCustomer.value = null
  editShowCustomerSearchResults.value = false
}

const loadDialogData = async () => {
  if (!dialogVisible.value || !props.phoneId) return

  const token = ++lastLoadToken
  initializing.value = true

  try {
    const [loadedOptions, response] = await Promise.all([
      fetchEditOptions(),
      unifiedApi.get(`/query/phone/${props.phoneId}`)
    ])

    if (token !== lastLoadToken) return

    Object.assign(options, loadedOptions)

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取手机数据失败')
    }

    const normalized = normalizePhoneData(response.data)
    const basicInfo = normalized.基本信息 || {}
    const supplierInfo = normalized.供应商信息 || {}
    const storeInfo = normalized.店铺信息 || {}
    const priceInfo = normalized.价格信息 || {}
    const timeInfo = normalized.时间信息 || {}
    const customerInfo = normalized.客户信息 || {}
    const operatorInfo = normalized.操作员信息 || {}
    const saleInfo = normalized.销售信息 || {}

    Object.assign(formData, {
      id: Number(basicInfo.phone_id || response.data?.id || props.phoneId || 0),
      imei: basicInfo.imei || response.data?.imei || '',
      serial_number: basicInfo.serial_number || response.data?.serial_number || '',
      brand_id: basicInfo.brand_id ?? response.data?.brand_id ?? null,
      brand: basicInfo.brand || response.data?.brand || '',
      model_id: basicInfo.model_id ?? response.data?.model_id ?? null,
      model: basicInfo.model || response.data?.model || '',
      color_id: basicInfo.color_id ?? response.data?.color_id ?? null,
      color: basicInfo.color || response.data?.color || '',
      memory_id: basicInfo.memory_id ?? response.data?.memory_id ?? null,
      memory: basicInfo.memory || response.data?.memory || '',
      is_new: basicInfo.is_new === 1 ? '1' : '0',
      status: basicInfo.status_code || response.data?.status || 'in_stock',
      purchase_price: Number(priceInfo.purchase_price ?? response.data?.purchase_price ?? 0),
      sale_price: Number(priceInfo.sale_price ?? response.data?.sale_price ?? 0),
      customer_id: customerInfo.customer_id ? String(customerInfo.customer_id) : '',
      customer_phone: normalizeCustomerPhone(customerInfo.customer_phone || response.data?.customer_phone || ''),
      customer_name: normalizePersonName(customerInfo.customer_name || response.data?.customer_name || '', 20),
      apple_id: normalizeAppleId(customerInfo.apple_id || response.data?.customer_apple_id || response.data?.apple_id || ''),
      store_id: storeInfo.store_id ?? response.data?.store_id ?? null,
      purchase_operator_name: operatorInfo.inventory_operator_name || operatorInfo.purchase_operator_name || response.data?.inventory_operator_name || '',
      purchase_operator_id: operatorInfo.inventory_operator_id ? String(operatorInfo.inventory_operator_id) : (response.data?.inventory_operator_id ? String(response.data.inventory_operator_id) : ''),
      sale_operator_id: operatorInfo.sale_operator_id ? String(operatorInfo.sale_operator_id) : (response.data?.sale_operator_id ? String(response.data.sale_operator_id) : ''),
      supplier_id: supplierInfo.supplier_id ?? response.data?.supplier_id ?? null,
      Inventorytime: normalizeDate(timeInfo.Inventorytime || response.data?.Inventorytime),
      salestime: normalizeDate(timeInfo.salestime || response.data?.salestime),
      payment_method: saleInfo.payment_method || response.data?.payment_method || '',
      payment_channel: saleInfo.payment_channel || response.data?.payment_channel || '',
      isNoIMEIMode: false,
      remarks: basicInfo.remarks || response.data?.remarks || ''
    })

    syncCatalogSelections()

    originalEditValues.value = {
      customer_id: formData.customer_id,
      sale_operator_id: formData.sale_operator_id,
      purchase_operator_id: formData.purchase_operator_id,
      apple_id: formData.apple_id
    }

    if (customerInfo.customer_id && customerInfo.customer_name) {
      editFoundCustomer.value = {
        id: customerInfo.customer_id,
        name: normalizePersonName(customerInfo.customer_name, 20),
        phone: normalizeCustomerPhone(customerInfo.customer_phone || ''),
        apple_id: normalizeAppleId(customerInfo.apple_id || '')
      }
    }
  } catch (error: unknown) {
    ElMessage.error(error?.message || '获取手机数据失败，请稍后重试')
    dialogVisible.value = false
  } finally {
    if (token === lastLoadToken) {
      initializing.value = false
    }
  }
}

const handleBrandChange = (brandName: string) => {
  formData.brand = brandName
  const previousBrandId = formData.brand_id
  syncBrandId()

  const currentModel = findModelOption(formData.model, formData.brand_id, formData.brand)
  const brandChanged = previousBrandId !== formData.brand_id

  if (!currentModel || brandChanged) {
    formData.model = ''
    formData.model_id = null
    return
  }

  formData.model_id = currentModel.id || null
}

const handleModelChange = (modelName: string) => {
  formData.model = modelName
  syncModelId()
}

const handleColorChange = (colorName: string) => {
  formData.color = colorName
  syncColorId()
}

const handleMemoryChange = (memoryName: string) => {
  formData.memory = memoryName
  syncMemoryId()
}

const formatSerialNumber = () => {
  formData.serial_number = formData.serial_number.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 18)
}

const formatPriceInputValue = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

const handlePriceInput = (field: PriceField, value: string) => {
  const sanitized = String(value || '').replace(/[^\d]/g, '')
  formData[field] = sanitized ? Number(sanitized) : 0
}

const formatImei = () => {
  if (formData.isNoIMEIMode) {
    formData.imei = formData.imei.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 30)
    return
  }
  formData.imei = formData.imei.replace(/[^\d]/g, '').slice(0, 15)
}

const toggleNoIMEIMode = () => {
  formData.isNoIMEIMode = !formData.isNoIMEIMode

  if (formData.isNoIMEIMode) {
    formData.imei = formData.serial_number || ''
    ElMessage.success('已启用无IMEI模式')
    return
  }

  formData.imei = ''
  ElMessage.info('已切换回标准 IMEI 模式')
}

const formatCustomerPhone = () => {
  formData.customer_phone = normalizeCustomerPhone(formData.customer_phone)
}

const formatCustomerName = () => {
  formData.customer_name = normalizePersonName(formData.customer_name, 20)
}

const formatAppleId = () => {
  formData.apple_id = normalizeAppleId(formData.apple_id)
}

const formatRemarks = () => {
  formData.remarks = formData.remarks
    .replace(/<[^>]*>/g, '')
    .replace(/["'<>]/g, '')
    .trim()
    .slice(0, 200)
}

const searchCustomers = async (query: string) => {
  if (!query || query.length < 3) {
    editCustomerOptions.value = []
    editShowCustomerSearchResults.value = false
    return
  }

  editCustomerLookupLoading.value = true
  editShowCustomerSearchResults.value = true

  try {
    const response = await unifiedApi.get(`/sales/customers?search=${encodeURIComponent(query)}`)
    if (response.success) {
      const records = extractResponseData<Array<Partial<CustomerOption>>>(response)
      editCustomerOptions.value = records.map((item) => normalizeCustomerOption(item))
      editShowCustomerSearchResults.value = editCustomerOptions.value.length > 0 || query.length >= 11
      return
    }

    editCustomerOptions.value = []
    editShowCustomerSearchResults.value = query.length >= 11
  } catch (error) {
    editCustomerOptions.value = []
    editShowCustomerSearchResults.value = query.length >= 11
  } finally {
    editCustomerLookupLoading.value = false
  }
}

const handleCustomerPhoneInput = () => {
  formatCustomerPhone()

  if (editCustomerSearchTimeout.value) {
    clearTimeout(editCustomerSearchTimeout.value)
  }

  if (!formData.customer_phone) {
    editCustomerOptions.value = []
    editFoundCustomer.value = null
    editShowCustomerSearchResults.value = false
    formData.customer_id = ''
    return
  }

  if (editFoundCustomer.value && normalizeCustomerPhone(editFoundCustomer.value.phone) !== formData.customer_phone) {
    editFoundCustomer.value = null
    formData.customer_id = ''
  }

  if (formData.customer_phone.length >= 3) {
    editShowCustomerSearchResults.value = true
  }

  editCustomerSearchTimeout.value = setTimeout(() => {
    void searchCustomers(formData.customer_phone.trim())
  }, 150)
}

const handleCustomerPhoneBlur = (event: FocusEvent) => {
  formatCustomerPhone()

  setTimeout(() => {
    const activeElement = document.activeElement as HTMLElement | null
    const clickedSearchResult = event.relatedTarget instanceof HTMLElement
      && Boolean(event.relatedTarget.closest('.customer-search-results'))

    const editingCustomerFields = activeElement
      && ['customer_name', 'apple_id'].includes(activeElement.getAttribute('data-field') || '')

    if (clickedSearchResult || editingCustomerFields) return
    if (activeElement?.closest('.customer-search-container')) return

    editShowCustomerSearchResults.value = false
  }, 250)
}

const selectCustomer = (customer: CustomerOption) => {
  const normalizedCustomer = normalizeCustomerOption(customer)
  formData.customer_phone = normalizedCustomer.phone
  formData.customer_name = normalizedCustomer.name
  formData.apple_id = normalizedCustomer.apple_id || ''
  formData.customer_id = String(normalizedCustomer.id)
  editFoundCustomer.value = normalizedCustomer
  editCustomerOptions.value = []
  editShowCustomerSearchResults.value = false
}

const createNewCustomer = async () => {
  formatCustomerName()
  formatAppleId()

  if (!formData.customer_name) {
    ElMessage.error('请先输入客户姓名')
    return
  }

  if (!isValidMobilePhone(formData.customer_phone)) {
    ElMessage.error('请输入有效的手机号码')
    return
  }

  editCustomerLookupLoading.value = true

  try {
    const normalizedAppleId = normalizeAppleId(formData.apple_id)
    const response = await unifiedApi.post('/customers', {
      name: formData.customer_name,
      phone: normalizeCustomerPhone(formData.customer_phone),
      apple_id: normalizedAppleId || null,
      email: resolveAppleAccountEmail(normalizedAppleId),
      customer_type: 'individual',
      vip_level: 'normal',
      total_purchase_amount: 0,
      total_purchase_count: 0,
      notes: `通过综合查询编辑设备创建 - ${TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)}`,
      source: 'query_edit_modal'
    })

    if (!response.success || !response.data) {
      throw new Error(response.message || '创建客户失败')
    }

    const newCustomer = normalizeCustomerOption(response.data)
    selectCustomer(newCustomer)
    ElMessage.success(`新客户 "${newCustomer.name}" 创建成功`)
  } catch (error: unknown) {
    ElMessage.error(error?.message || '创建客户失败')
  } finally {
    editCustomerLookupLoading.value = false
  }
}

const handleCustomerClear = () => {
  formData.customer_name = ''
  formData.apple_id = ''
  formData.customer_id = ''
  editFoundCustomer.value = null
  editCustomerOptions.value = []
  editShowCustomerSearchResults.value = false
}

const calculateSubsidyRemarks = () => {
  const salePrice = Number(formData.sale_price || 0)
  if (salePrice <= 0) return

  if (salePrice > 6000) {
    if (formData.payment_method === 'subsidy_card') {
      ElMessage.error('销售金额超过6000元，无法使用国补刷卡')
      formData.payment_method = ''
      formData.payment_channel = ''
    }
    if (formData.remarks.startsWith('刷卡实际支付')) {
      formData.remarks = ''
    }
    return
  }

  const discount = Math.min(salePrice * 0.15, 500)
  const actualPayment = Math.round((salePrice - discount) * 100) / 100

  if (!formData.remarks.trim() || formData.remarks.startsWith('刷卡实际支付')) {
    formData.remarks = `刷卡实际支付${actualPayment}元`
  }
}

const handlePaymentMethodChange = () => {
  if (formData.payment_method === 'subsidy_card') {
    const salePrice = Number(formData.sale_price || 0)
    if (salePrice > 6000) {
      ElMessage.error('销售金额超过6000元，无法使用国补刷卡')
      formData.payment_method = ''
      formData.payment_channel = ''
      formData.remarks = ''
      return
    }
    formData.payment_channel = 'subsidy_card'
    calculateSubsidyRemarks()
    return
  }

  formData.payment_channel = ''
  if (formData.remarks.startsWith('刷卡实际支付')) {
    formData.remarks = ''
  }
}

const handlePaymentChannelChange = () => {
  if (formData.payment_channel === 'subsidy_card') {
    calculateSubsidyRemarks()
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return

  formatCustomerPhone()
  formatCustomerName()
  formatAppleId()
  formatRemarks()

  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  if (formData.imei !== formData.serial_number && (!formData.imei || formData.imei.length < 15)) {
    ElMessage.error('请输入完整的15位IMEI号')
    return
  }

  if (!formData.serial_number) {
    ElMessage.error('请输入序列号')
    return
  }

  submitting.value = true

  try {
    syncCatalogSelections()
    const normalizedCustomerPhone = normalizeCustomerPhone(formData.customer_phone)
    const normalizedCustomerName = normalizePersonName(formData.customer_name, 20)
    const normalizedAppleId = normalizeAppleId(formData.apple_id)

    if (!formData.brand_id || !formData.model_id || !formData.color_id || !formData.memory_id) {
      ElMessage.error('品牌、型号、颜色、内存必须从数据库已有选项中选择，不能使用不存在的数据')
      return
    }

    const requestData: PhoneUpdateRequest = {
      brand_id: formData.brand_id,
      model_id: formData.model_id,
      color_id: formData.color_id,
      memory_id: formData.memory_id,
      brand: formData.brand,
      model: formData.model,
      color: formData.color,
      memory: formData.memory,
      imei: formData.imei,
      serial_number: formData.serial_number,
      condition: formData.is_new === '1' ? 'new' : 'used',
      supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
      store_id: formData.store_id ? Number(formData.store_id) : null,
      purchase_price: Number(formData.purchase_price || 0),
      sale_price: Number(formData.sale_price || 0),
      customer_phone: normalizedCustomerPhone,
      customer_name: normalizedCustomerName || null,
      Inventorytime: formData.Inventorytime || null,
      salestime: formData.salestime || null,
      status: formData.status,
      remarks: formData.remarks || '',
      payment_method: formData.payment_method || null,
      payment_channel: formData.payment_channel || null
    }

    if (formData.customer_id !== originalEditValues.value.customer_id) {
      requestData.customer_id = formData.customer_id ? Number(formData.customer_id) : null
    } else if (formData.customer_id) {
      requestData.customer_id = Number(formData.customer_id)
    }

    if (formData.sale_operator_id !== originalEditValues.value.sale_operator_id) {
      requestData.sale_operator_id = formData.sale_operator_id ? Number(formData.sale_operator_id) : null
    }

    if (formData.purchase_operator_id !== originalEditValues.value.purchase_operator_id) {
      requestData.purchase_operator_id = formData.purchase_operator_id ? Number(formData.purchase_operator_id) : null
    }

    if (normalizedAppleId !== originalEditValues.value.apple_id) {
      requestData.apple_id = normalizedAppleId || null
    }

    const response = await unifiedApi.put(`/phones/${formData.id}`, requestData)

    if (!response.success) {
      throw new Error(response.message || '更新失败')
    }

    ElMessage.success('设备信息更新成功')
    emit('success')
    dialogVisible.value = false
  } catch (error: unknown) {
    ElMessage.error(error?.response?.data?.message || error?.message || '更新失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

const handleClosed = () => {
  resetFormState()
}

watch(
  () => [dialogVisible.value, props.phoneId] as const,
  ([visible, phoneId]) => {
    if (visible && phoneId) {
      void loadDialogData()
      return
    }

    if (!visible) {
      lastLoadToken += 1
      initializing.value = false
    }
  },
  { immediate: true }
)

watch(
  () => formData.sale_price,
  () => {
    if (salePriceDebounceTimer) {
      clearTimeout(salePriceDebounceTimer)
    }

    salePriceDebounceTimer = setTimeout(() => {
      if (formData.payment_method === 'subsidy_card' || formData.payment_channel === 'subsidy_card') {
        calculateSubsidyRemarks()
      }
    }, 300)
  }
)

onBeforeUnmount(() => {
  if (editCustomerSearchTimeout.value) {
    clearTimeout(editCustomerSearchTimeout.value)
  }
  if (salePriceDebounceTimer) {
    clearTimeout(salePriceDebounceTimer)
  }
})
</script>

<style lang="scss" scoped>
.dialog-loading {
  padding: 8px 0 4px;
}

.dialog-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
}

.edit-form-content {
  padding: 0;
}

.form-section {
  margin-bottom: 24px;
  padding: 18px 18px 14px;
  border: 1px solid #eef2f7;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;

  i {
    color: #2563eb;
  }
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.form-row-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.form-row-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.form-row-5 {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.full-width {
  width: 100%;
}

// 日期选择器输入框紧凑宽度 - PC端
:deep(.el-date-editor.el-input),
:deep(.el-date-editor) {
  width: 140px !important;
  min-width: 140px !important;
  max-width: 140px !important;
}

// 日期选择器表单项紧凑宽度
.date-picker-item {
  width: 140px !important;
  flex: 0 0 140px !important;
  max-width: 140px !important;
}

.date-picker-item :deep(.el-date-editor) {
  width: 140px !important;
}

.date-picker-item :deep(.el-input__wrapper) {
  width: 140px !important;
}

:global(.query-edit-dialog-popper) {
  z-index: 4001 !important;
}

:global(.query-edit-dialog-popper .el-select-dropdown__item),
:global(.query-edit-dialog-popper .el-picker-panel__shortcut) {
  min-height: 40px;
  height: auto !important;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
  padding-top: 10px;
  padding-bottom: 10px;
}

:global(.query-edit-dialog-popper .el-select-dropdown__wrap) {
  max-height: min(320px, 55vh);
}

:global(.query-edit-dialog-popper.el-select__popper .el-select-dropdown),
:global(.query-edit-dialog-popper.el-select__popper .el-scrollbar),
:global(.query-edit-dialog-popper.el-select__popper .el-select-dropdown__wrap),
:global(.query-edit-dialog-popper.el-select__popper .el-select-dropdown__list) {
  width: 100% !important;
  min-width: 0 !important;
}

/* 日历弹出面板紧凑宽度 */
:global(.query-edit-dialog-popper.el-picker__popper) {
  width: auto !important;
  min-width: 0 !important;
  max-width: 320px !important;
}

:global(.query-edit-dialog-popper.el-picker__popper .el-picker-panel),
:global(.query-edit-dialog-popper.el-picker__popper .el-date-picker__header),
:global(.query-edit-dialog-popper.el-picker__popper .el-picker-panel__content) {
  width: auto !important;
  min-width: 0 !important;
  max-width: 320px !important;
  box-sizing: border-box;
}

:global(.query-edit-dialog-popper.el-picker__popper .el-picker-panel__body) {
  width: auto !important;
  min-width: 0 !important;
}

/* 日期选择器输入框使用紧凑宽度 - PC端 */
:global(.query-edit-dialog .el-date-editor.el-input),
:global(.query-edit-dialog .el-date-editor) {
  width: 140px !important;
  min-width: 140px !important;
  max-width: 140px !important;
}

:global(.query-edit-dialog) {
  --dialog-side-gap: 2px;
  --dialog-vertical-gap: 4px;
  --dialog-max-width: calc(100vw - 4px);
  --mobile-dialog-body-padding: 6px 6px 8px;
  --mobile-dialog-footer-padding: 0 6px 6px;
}

:global(.query-edit-dialog.mobile-dialog-sheet-overlay) {
  background: rgba(15, 23, 42, 0.42) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

:global(.query-edit-dialog.mobile-dialog-sheet-panel) {
  border-radius: 28px !important;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24) !important;
}

:global(.query-edit-dialog .mobile-dialog-sheet-header) {
  min-height: calc(72px + env(safe-area-inset-top));
  padding: calc(12px + env(safe-area-inset-top)) 56px 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
}

:global(.query-edit-dialog .mobile-dialog-sheet-title) {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
}

:global(.query-edit-dialog .mobile-dialog-sheet-close) {
  top: calc(12px + env(safe-area-inset-top));
  right: 16px;
  transform: none;
  background: rgba(255, 255, 255, 0.16);
}

:global(.query-edit-dialog .mobile-dialog-sheet-body) {
  background: #ffffff;
}

:global(.query-edit-dialog .mobile-dialog-sheet-footer) {
  background: #ffffff;
}

.input-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: #6b7280;
}

.profit-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
}

.profit-value {
  font-weight: 700;
  color: #059669;
}

.imei-input-wrapper {
  cursor: pointer;
}

.imei-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #10b981;
}

.customer-search-container {
  position: relative;
}

.customer-search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 25;
  max-height: 280px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #dbe3ef;
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
}

.search-loading,
.customer-item,
.create-new-customer {
  padding: 12px 14px;
}

.search-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
}

.customer-item {
  cursor: pointer;
  transition: background-color 0.16s ease;

  &:hover {
    background: #f8fafc;
  }
}

.customer-name {
  font-weight: 600;
  color: #111827;
}

.customer-phone,
.customer-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.create-new-customer {
  cursor: pointer;
  color: #2563eb;
  border-top: 1px solid #eef2f7;

  &:hover {
    background: #eff6ff;
  }
}

.create-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}

:deep(.el-form-item) {
  margin-bottom: 14px;
}

:deep(.el-input),
:deep(.el-select),
:deep(.el-date-editor.el-input),
:deep(.el-input-number) {
  width: 100%;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper),
:deep(.el-date-editor .el-input__wrapper),
:deep(.el-input-number .el-input__wrapper),
:deep(.el-textarea__inner) {
  border-radius: 12px;
  box-shadow: 0 0 0 1px #dbe3ef inset;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper),
:deep(.el-date-editor .el-input__wrapper),
:deep(.el-input-number .el-input__wrapper) {
  min-height: 42px;
  padding: 1px 12px;
}

:deep(.el-input__inner),
:deep(.el-select__selected-item),
:deep(.el-date-editor .el-input__inner),
:deep(.el-input-number .el-input__inner),
:deep(.el-textarea__inner) {
  font-size: 14px;
}

:deep(.el-input-number .el-input__wrapper) {
  width: 100%;
}

:deep(.el-input-number .el-input-number__decrease),
:deep(.el-input-number .el-input-number__increase) {
  border-radius: 10px;
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-select__wrapper.is-focused),
:deep(.el-date-editor .el-input__wrapper.is-focus),
:deep(.el-input-number .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #7c3aed inset;
}

:deep(.el-input-number .el-input__wrapper) {
  width: 100%;
}

@media (max-width: 1200px) {
  .form-row-5,
  .form-row-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-row-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .form-section {
    margin-bottom: 12px;
    padding: 10px 8px 8px;
    border-radius: 14px;
  }

  .form-row,
  .form-row-3,
  .form-row-4,
  .form-row-5 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .mobile-span-2 {
    grid-column: span 2;
  }

  .dialog-footer {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;

    :deep(.el-button) {
      width: 100%;
      height: 42px;
      margin: 0;
      border-radius: 12px;
      font-size: 13px;
      padding: 0 10px;
    }

    :deep(.el-button [class*='fa-']) {
      margin-right: 4px;
    }
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-date-editor .el-input__wrapper),
  :deep(.el-input-number .el-input__wrapper) {
    min-height: 40px;
    padding: 1px 10px;
  }

  :deep(.el-input__inner),
  :deep(.el-select__selected-item),
  :deep(.el-date-editor .el-input__inner),
  :deep(.el-input-number .el-input__inner),
  :deep(.el-textarea__inner) {
    font-size: 13px;
  }

  :deep(.el-form-item) {
    margin-bottom: 8px;
  }
}

@media (max-width: 480px) {
  :global(.query-edit-dialog) {
    --dialog-side-gap: 4px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 8px);
    --mobile-dialog-body-padding: 6px 4px 6px;
    --mobile-dialog-footer-padding: 0 4px 4px;
  }

  :global(.query-edit-dialog.mobile-dialog-sheet-panel) {
    border-radius: 24px !important;
  }

  :global(.query-edit-dialog .mobile-dialog-sheet-header) {
    min-height: calc(62px + env(safe-area-inset-top));
    padding: calc(8px + env(safe-area-inset-top)) 50px 8px 14px;
  }

  :global(.query-edit-dialog .mobile-dialog-sheet-close) {
    top: calc(8px + env(safe-area-inset-top));
    right: 14px;
  }

  .form-section {
    padding: 8px 6px 6px;
    border-radius: 12px;
  }
}

@media (max-width: 767px) {
  :global(.query-edit-dialog-popper.el-popper),
  :global(.query-edit-dialog-popper.el-select__popper),
  :global(.query-edit-dialog-popper.el-picker__popper) {
    width: min(360px, calc(100vw - 12px)) !important;
    max-width: calc(100vw - 12px) !important;
  }

  :global(.query-edit-dialog-popper .el-picker-panel) {
    width: 100% !important;
    max-width: 100% !important;
  }

  :global(.query-edit-dialog-popper.el-picker__popper) {
    left: 6px !important;
    right: 6px !important;
  }
}
</style>
