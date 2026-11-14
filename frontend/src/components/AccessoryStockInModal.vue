<!--
  AccessoryStockInModal - 配件入库/编辑模态框

  功能描述：
  - 配件入库：按商品名称搜索模板或列表行内补货
  - 配件编辑：修改配件基础信息
  - 支持图片上传
  - 同一模板支持数量与SN批次入库，归属本次所选店铺
  - 现代化UI设计，响应式布局

  API接口：
  - GET /accessories/barcode/:barcode - 根据条码查询配件
  - POST /accessories/stock-in - 配件入库
  - PUT /accessories/:id - 更新配件
  - GET /accessories/options - 公共资料、商品类型及按品牌适配型号
-->
<template>
  <MobileDialog
    v-model="visible"
    :title="isEditMode ? '编辑商品模板' : props.archiveOnly ? '商品模板' : '配件入库'"
    :close-on-click-modal="false"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
    dialog-class="crud-dialog-lg accessory-dialog"
    :show-default-footer="false"
    destroy-on-close
    @close="handleDialogClose"
  >
    <div
      class="dialog-body"
      :class="{ 'template-editor': props.archiveOnly || isEditMode }"
    >
      <el-alert
        v-if="isStockInMode && pendingStockIn"
        type="warning"
        :closable="false"
        title="上次入库结果尚未确认，请重试原入库；系统会核对原采购，不会重复入库。确认前暂不能新增另一笔。"
      />
      <el-alert
        v-if="isStockInMode && recoveryError"
        type="error"
        :closable="false"
        :title="recoveryError"
      />
      <el-form
        v-if="!isStockInMode || !pendingStockIn"
        ref="formRef"
        :model="formData"
        :rules="formRules"
        :disabled="submitting"
        label-position="top"
        class="accessory-form tf-dialog-form tf-dialog-form--stacked tf-form-layout tf-form-grid"
      >
        <div class="info-card">
          <div class="card-header">
            <div class="card-icon">
              <i class="fas fa-info-circle" />
            </div>
            <h3 class="card-title">
              基本信息
            </h3>
          </div>
          <div class="card-content">
            <el-row :gutter="16">
              <el-col
                v-for="field in basicFields"
                :key="field"
                :xs="12"
                :sm="12"
                :md="6"
              >
                <el-form-item
                  v-if="field === 'name'"
                  label="商品名称"
                  prop="name"
                >
                  <el-select
                    v-if="isStockInMode"
                    :model-value="existingAccessory?.id"
                    placeholder="搜索商品名称"
                    aria-label="按商品名称选择模板"
                    filterable
                    remote
                    :disabled="isFixedTemplate"
                    :remote-method="searchTemplates"
                    :loading="templatesLoading || searching"
                    @visible-change="handleTemplateDropdown"
                    @change="selectTemplate"
                  >
                    <div
                      v-infinite-scroll="loadMoreTemplates"
                      :infinite-scroll-disabled="templatesLoading || templateResults.length >= templateTotal"
                    >
                      <el-option-group
                        v-for="group in templateGroups"
                        :key="group.name"
                        :label="group.name"
                      >
                        <el-option
                          v-for="item in group.items"
                          :key="item.id"
                          :label="getTemplateLabel(item)"
                          :value="item.id"
                        />
                      </el-option-group>
                    </div>
                  </el-select>
                  <el-input
                    v-else
                    v-model="formData.name"
                    placeholder="请输入商品名称"
                    :disabled="isStockInMode || !!existingAccessory"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'operator_name'"
                  label="入库员"
                >
                  <el-input
                    :model-value="authStore.user?.name || authStore.user?.username || ''"
                    readonly
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'distribution'"
                  label="店铺"
                  prop="store_id"
                >
                  <el-select
                    v-model="formData.store_id"
                    placeholder="选择入库店铺"
                    filterable
                    aria-label="入库店铺"
                  >
                    <el-option
                      v-for="store in stores"
                      :key="store.id"
                      :label="store.name"
                      :value="store.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'usage_type'"
                  label="入库用途"
                  prop="usage_type"
                  required
                >
                  <el-select
                    v-model="formData.usage_type"
                    aria-label="入库用途"
                  >
                    <el-option
                      label="收费"
                      value="sale"
                    />
                    <el-option
                      label="赠送"
                      value="gift"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'total_quantity'"
                  label="入库总数"
                  prop="total_quantity"
                >
                  <el-input-number
                    v-model="formData.total_quantity"
                    :min="1"
                    :max="9999"
                    :controls="false"
                    :precision="0"
                    aria-label="入库总数"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'category'"
                  label="商品类型"
                >
                  <el-input
                    v-if="isStockInMode"
                    :model-value="formData.category || categories.find(item => item.id === formData.category_id)?.name || ''"
                    placeholder="选择商品后自动填充"
                    readonly
                  />
                  <el-select
                    v-else
                    v-model="formData.category_id"
                    placeholder="选择商品类型"
                    filterable
                    :disabled="!!existingAccessory"
                    clearable
                  >
                    <el-option
                      v-for="category in categories"
                      :key="category.id"
                      :label="category.name"
                      :value="Number(category.id)"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'model_brand'"
                  label="适配品牌"
                >
                  <el-select
                    v-model="modelBrandId"
                    placeholder="通用"
                    aria-label="适配品牌"
                    :disabled="!!existingAccessory"
                    clearable
                    filterable
                  >
                    <el-option
                      label="通用"
                      :value="0"
                    />
                    <el-option
                      v-for="brand in modelBrands"
                      :key="brand.id"
                      :label="brand.name"
                      :value="brand.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'model_name'"
                  label="适配型号"
                >
                  <el-select
                    v-model="formData.model_ids"
                    placeholder="通用"
                    aria-label="适配型号"
                    multiple
                    collapse-tags
                    collapse-tags-tooltip
                    clearable
                    filterable
                    :disabled="(!modelBrandId && !formData.model_ids.length) || !!existingAccessory"
                    :loading="modelsLoading"
                  >
                    <el-option
                      v-for="model in models"
                      :key="model.id"
                      :label="model.name"
                      :value="model.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'brand_name'"
                  label="品牌"
                >
                  <el-select
                    v-model="formData.brand_id"
                    placeholder="选择品牌"
                    clearable
                    filterable
                    @clear="formData.brand_id = null"
                  >
                    <el-option
                      v-for="brand in brands"
                      :key="brand.id"
                      :label="brand.name"
                      :value="brand.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'product_model'"
                  label="配件型号"
                >
                  <el-input
                    v-model="formData.product_model"
                    placeholder="厂家型号，可不填"
                    :maxlength="100"
                    clearable
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'color_name'"
                  label="颜色"
                >
                  <el-select
                    v-model="formData.color_id"
                    :disabled="!!existingAccessory"
                    placeholder="选择颜色"
                    clearable
                    filterable
                  >
                    <el-option
                      v-for="color in colors"
                      :key="color.id"
                      :label="color.name"
                      :value="color.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'unit'"
                  label="单位"
                >
                  <el-select
                    v-model="formData.unit_id"
                    placeholder="选择计量单位"
                    :disabled="!!existingAccessory"
                    clearable
                  >
                    <el-option
                      v-for="unit in units"
                      :key="unit.id"
                      :label="unit.name"
                      :value="Number(unit.id)"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'supplier_name'"
                  label="供应商"
                  prop="supplier_id"
                >
                  <el-select
                    v-model="formData.supplier_id"
                    placeholder="选择供应商"
                    clearable
                    filterable
                  >
                    <el-option
                      v-for="supplier in suppliers"
                      :key="supplier.id"
                      :label="supplier.name"
                      :value="supplier.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'purchase_cost'"
                  label="进价"
                  prop="purchase_cost"
                >
                  <AmountInput
                    v-model="formData.purchase_cost"
                    :min="0"
                    :step="1"
                    class="full-width"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'sale_price'"
                  :label="isStockInMode ? '销售价' : '零售价'"
                >
                  <el-input
                    v-if="isStockInMode"
                    :model-value="isRestocking ? formatAmount(formData.sale_price) : ''"
                    placeholder="读取模板售价"
                    readonly
                    aria-label="销售价"
                  />
                  <AmountInput
                    v-else
                    v-model="formData.sale_price"
                    :min="0"
                    :step="1"
                    class="full-width"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'min_stock'"
                  label="预警值"
                >
                  <el-input-number
                    v-model="formData.min_stock"
                    :disabled="!!existingAccessory"
                    :min="0"
                    :max="9999"
                    :precision="0"
                    :controls="false"
                    class="full-width"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'serial_tracking'"
                  label="SN管理"
                >
                  <el-switch
                    v-model="formData.serial_tracking"
                    :active-value="1"
                    :inactive-value="0"
                    :disabled="isStockInMode && !existingAccessory"
                    aria-label="SN管理"
                    title="模板开关为默认值，本次入库可单独切换SN模式"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'status'"
                  label="状态"
                >
                  <el-switch
                    v-model="formData.status"
                    :disabled="!!existingAccessory"
                    :active-value="1"
                    :inactive-value="0"
                    aria-label="状态"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </div>

        <!-- 条形码和图片放在商品资料之后 -->
        <div
          v-if="!isStockInMode"
          class="scan-image-section"
        >
          <div
            v-if="canViewAccessoryField('barcode')"
            class="scan-area"
          >
            <el-form-item label="条形码">
              <div class="barcode-input-wrapper">
                <el-input
                  v-model="formData.barcode"
                  placeholder="手动输入或扫描条形码"
                  :disabled="isFixedTemplate"
                  :maxlength="100"
                  clearable
                  @keydown.enter.prevent
                >
                  <template #prefix>
                    <i class="fas fa-barcode" />
                  </template>
                </el-input>
              </div>
            </el-form-item>
          </div>

          <div
            v-if="canViewAccessoryField('image_url')"
            class="image-area"
          >
            <el-form-item
              class="tf-form-field--wide"
              label="商品图片"
            >
              <div
                class="image-upload-wrapper"
                @click="triggerUpload"
              >
                <el-upload
                  ref="uploadRef"
                  :action="uploadUrl"
                  :headers="uploadHeaders"
                  :show-file-list="false"
                  :before-upload="beforeImageUpload"
                  :on-success="handleImageSuccess"
                  :on-error="handleUploadError"
                  accept="image/*"
                  name="file"
                  :auto-upload="false"
                  :disabled="!!existingAccessory"
                  class="image-uploader"
                >
                  <div
                    v-if="formData.image_url"
                    class="image-preview"
                  >
                    <Image
                      :src="formData.image_url"
                      alt="配件图片"
                      mode="eager"
                    />
                    <div class="image-overlay">
                      <i class="fas fa-camera" />
                      <span>更换</span>
                    </div>
                  </div>
                  <div
                    v-else
                    class="image-placeholder"
                  >
                    <i class="fas fa-plus" />
                    <span>上传图片</span>
                  </div>
                </el-upload>
              </div>
            </el-form-item>
          </div>
        </div>

        <div
          v-if="isStockInMode && formData.serial_tracking === 1 && canViewAccessoryField('serial_number') && canViewAccessoryField('distribution')"
          class="info-card"
        >
          <div class="card-header">
            <h3 class="card-title">
              SN序列号录入（{{ serialEntries.length }} 件）
            </h3>
          </div>
          <div class="card-content">
            <el-alert
              v-if="serialValidationError"
              :title="serialValidationError"
              type="error"
              :closable="false"
            />
            <div class="serial-toolbar">
              <el-button
                :disabled="!formData.store_id || serialRows.length >= 1000"
                @click="addSerialRow"
              >
                新增一条
              </el-button>
              <el-button
                :disabled="!formData.store_id"
                @click="openSerialScanner()"
              >
                扫码SN
              </el-button>
              <el-button
                :disabled="!serialRows.length"
                @click="clearSerialRows"
              >
                清空SN
              </el-button>
            </div>
            <el-form-item
              v-for="(row, index) in serialRows"
              :key="row.id"
              :label="`SN ${index + 1}`"
            >
              <div class="serial-entry-row">
                <el-input
                  v-model="row.value"
                  :data-serial-row="row.id"
                  :maxlength="100"
                  placeholder="扫描或手动输入SN，回车继续下一条"
                  :disabled="!formData.store_id"
                  @keyup.enter.prevent="focusNextSerial(index)"
                />
                <el-button
                  :disabled="!formData.store_id"
                  @click="openSerialScanner(row.id)"
                >
                  扫码
                </el-button>
                <el-button @click="removeSerialRow(row.id)">
                  移除
                </el-button>
              </div>
            </el-form-item>
            <el-form-item
              class="tf-form-field--wide"
              label="批量录入SN"
            >
              <el-input
                v-model="serialBatchInput"
                type="textarea"
                class="tf-textarea"
                :rows="3"
                :maxlength="101000"
                placeholder="每行一个SN，粘贴多条后点击添加"
                :disabled="!formData.store_id"
              />
            </el-form-item>
            <el-button
              :disabled="!formData.store_id || !serialBatchInput.trim()"
              @click="appendSerialBatch"
            >
              添加多条SN
            </el-button>
          </div>
        </div>

        <!-- 备注 -->
        <div
          v-if="canViewAccessoryField('remarks')"
          class="info-card"
        >
          <div class="card-header">
            <div class="card-icon">
              <i class="fas fa-sticky-note" />
            </div>
            <h3 class="card-title">
              备注信息
            </h3>
          </div>
          <div class="card-content">
            <el-form-item
              class="tf-form-field--wide"
              label="备注"
            >
              <el-input
                v-model="formData.remarks"
                class="tf-textarea"
                type="textarea"
                :rows="2"
                placeholder="请输入备注信息（可选）"
              />
            </el-form-item>
          </div>
        </div>
      </el-form>
    </div>

    <OptimizedScanner
      v-if="serialScannerVisible"
      v-model:visible="serialScannerVisible"
      scan-type="serial"
      serial-profile="accessory"
      @success="acceptSerialScan"
      @manual="serialScannerVisible = false"
      @cancel="serialScannerVisible = false"
    />

    <template #footer>
      <div class="tf-dialog-actions dialog-footer">
        <el-button
          type="default"
          size="large"
          :disabled="submitting"
          @click="handleClose"
        >
          <i class="fas fa-times" />
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="submitting || (isStockInMode && purchaseStore.submitting) || (pendingStockIn ? !canRetryStockIn : !canSubmit)"
          size="large"
          @click="handleSubmit"
        >
          <i class="fas fa-check" />
          {{ isEditMode ? '保存模板' : props.archiveOnly ? '创建模板' : pendingStockIn ? '重试原入库' : '确认入库' }}
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, defineAsyncComponent } from 'vue'
import { normalizeAccessorySerial, isValidAccessorySerial } from '@/utils/accessory-serial'

const OptimizedScanner = defineAsyncComponent(() => import('@/components/OptimizedScanner.vue'))

import type { FormInstance, UploadRawFile } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { getAccessoryEntryOptions } from '@/services/reference-options'
import type { AccessoryUsageType, AccessoryRecord, AccessoryStockInInput, AccessoryStockInReceipt } from '@/types/accessory'
import { useAccessoryStockInStore } from '@/stores/accessory-stock-in'
import { isAccessoryStockInReceipt } from '@/utils/accessory-stock-in'
import type { PaginatedResponse } from '@/types'
import { useLatestRequest } from '@/composables/useLatestRequest'
import type { ReferenceRecord } from '@/services/reference-options'
import { deleteTempFiles } from '@/utils/temp-file-cleaner'
import { formatAmount } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'
import { getRequestErrorMessage, getRequestErrorPayload, getRequestErrorStatus } from '@/utils/api-response'
import type { ModelValueProps, UpdateModelValueEmits, SuccessEmits, CloseEmits } from '@/types/component'
import Image from './Image.vue'
import { storage } from '@/services/storage'
import {
  buildAccessoryStockInPayload,
  buildAccessoryUpdatePayload
} from './accessory-payload'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import {
  canViewAccessoryField,
  pickVisibleAccessoryFields,
  type AccessoryFieldName
} from './accessory-field-permissions'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


// Props
interface AccessoryStoreOption {
  id: number
  name: string
}

interface AccessoryOption {
  id: number
  name: string
  brand_id?: number
  status?: number
  sort_order?: number
}

interface AccessoryImageUploadResponse {
  success: boolean
  data?: { url?: string }
}

interface Props extends ModelValueProps {
  accessory?: AccessoryRecord
  archiveOnly?: boolean
  stockInOnly?: boolean
}

type Emits = UpdateModelValueEmits & SuccessEmits & CloseEmits

const emit = defineEmits<Emits>()

const props = defineProps<Props>()
const authStore = useAuthStore()
const purchaseStore = useAccessoryStockInStore()
const purchaseActorId = computed(() => Number(authStore.user?.id))
const pendingStockIn = computed(() => isStockInMode.value ? purchaseStore.pending[purchaseActorId.value] : undefined)
const recoveryError = ref('')

// 表单引用
const formRef = ref<FormInstance>()

// 编辑模式判断
const isEditMode = computed(() => Boolean(props.accessory?.id) && !props.stockInOnly)
const isStockInMode = computed(() => !props.archiveOnly && !isEditMode.value)
const isFixedTemplate = computed(() => isStockInMode.value && props.stockInOnly && Boolean(props.accessory?.id))

const basicFields = computed(() => {
  const order = isStockInMode.value
    ? ['supplier_name', 'brand_name', 'name', 'distribution', 'category', 'product_model', 'color_name', 'purchase_cost', 'sale_price', 'total_quantity', 'operator_name', 'usage_type', 'serial_tracking'] as const
    : ['name', 'category', 'model_brand', 'model_name', 'product_model', 'color_name', 'unit', 'sale_price', 'min_stock', 'status', 'serial_tracking'] as const
  return order.filter(field => !(isStockInMode.value && field === 'total_quantity' && formData.value.serial_tracking === 1) && canViewAccessoryField(
    field === 'model_brand' ? 'model_name' : field
  ))
})

// 响应式数据
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const templateSearchRequest = useLatestRequest()
const templateResults = ref<AccessoryRecord[]>([])
const templatePage = ref(1)
const templatePageSize = 20
const templateTotal = ref(0)
const templateKeyword = ref('')
const templatesLoading = ref(false)
const accessorySelectionRequest = useLatestRequest()
const searching = ref(false)
const submitting = ref(false)
const existingAccessory = ref<AccessoryRecord | null>(null)
const uploadedTempImages = ref<string[]>([])

const getTemplateCategory = (item: AccessoryRecord) => item.category ||
  categories.value.find(category => category.id === Number(item.category_id))?.name || '未设置类型'

const templateGroups = computed(() => {
  if (!canViewAccessoryField('name')) return []
  const items = existingAccessory.value
    ? [existingAccessory.value, ...templateResults.value.filter(item => item.id !== existingAccessory.value?.id)]
    : templateResults.value
  const groups = new Map<string, AccessoryRecord[]>()
  for (const item of items) {
    const category = canViewAccessoryField('category') ? getTemplateCategory(item) : '商品'
    const group = groups.get(category) || []
    group.push(item)
    groups.set(category, group)
  }
  return [...groups].map(([name, items]) => ({ name, items }))
})

const getTemplateLabel = (item: AccessoryRecord) => canViewAccessoryField('name') ? item.name : ''

const loadTemplates = async (append = false) => {
  const request = templateSearchRequest.nextRequest()
  templatesLoading.value = true
  try {
    const response = await unifiedApi.get<Pick<PaginatedResponse<AccessoryRecord>, 'data' | 'pagination'>>('/accessories', {
      params: { mode: 'templates', page: templatePage.value, page_size: templatePageSize, search: templateKeyword.value || undefined },
      signal: request.signal, useCache: false, showLoading: false
    })
    if (!request.isLatest() || !visible.value) return
    templateResults.value = append ? [...templateResults.value, ...(response.data?.data || [])] : response.data?.data || []
    templateTotal.value = Number(response.data?.pagination?.total || 0)
  } catch (err) {
    if (!request.isLatest() || templateSearchRequest.isCanceledError(err)) return
    if (!append) { templateResults.value = []; templateTotal.value = 0 }
    else templatePage.value--
    logger.error('加载商品模板失败', err)
  } finally {
    if (request.isLatest()) templatesLoading.value = false
  }
}

const searchTemplates = async (keyword: string) => {
  templateKeyword.value = keyword.trim()
  templatePage.value = 1
  await loadTemplates()
}

const handleTemplateDropdown = (opened: boolean) => {
  if (opened && !isFixedTemplate.value) void searchTemplates('')
}

const loadMoreTemplates = async () => {
  if (templatesLoading.value || templateResults.value.length >= templateTotal.value) return
  templatePage.value++
  await loadTemplates(true)
}

// 表单数据
const formData = ref({
  barcode: '',
  accessory_id: null as number | null,
  id: null as number | null,
  name: '',
  category: '',
  category_id: null as number | null,
  product_model: '',
  serial_tracking: 0,
  usage_type: 'sale' as AccessoryUsageType,
  brand_id: null as number | null,
  model_id: null as number | null,
  model_ids: [] as number[],
  color_id: null as number | null,
  supplier_id: null as number | null,
  purchase_cost: 0,
  sale_price: 0,
  unit: '个',
  unit_id: null as number | null,
  status: 1,
  min_stock: 5,
  image_url: '',
  total_quantity: 1,
  store_id: null as number | null,
  remarks: ''
})

const isRestocking = computed(() => !isEditMode.value && !props.archiveOnly && Boolean(formData.value.accessory_id))

// 表单验证规则
const formRules = {
  name: [{ required: true, message: '请输入配件名称', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择商品类型', trigger: 'change' }],
  unit_id: [{ required: true, message: '请选择计量单位', trigger: 'change' }],
  supplier_id: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  purchase_cost: [{ required: true, message: '请输入进价', trigger: 'blur' }],
  total_quantity: [{ required: true, message: '请输入入库数量', trigger: 'blur' }]
}

// 下拉选项数据
const categories = ref<AccessoryOption[]>([])
const units = ref<AccessoryOption[]>([])
const brands = ref<AccessoryOption[]>([])
const modelBrands = ref<AccessoryOption[]>([])
const modelBrandId = ref<number | null>(null)
const modelsLoading = ref(false)
const optionsLoading = ref(false)
const optionsReady = ref(false)
let modelRequestId = 0
let optionsRequestId = 0
let hydrating = false
const models = ref<AccessoryOption[]>([])
const colors = ref<AccessoryOption[]>([])
const suppliers = ref<AccessoryOption[]>([])
const stores = ref<AccessoryStoreOption[]>([])
let nextSerialRowId = 0
const serialRows = ref<Array<{ id: number; value: string }>>([])
const serialBatchInput = ref('')
const serialScannerVisible = ref(false)
const serialScanTarget = ref<number | null>(null)
const serialEntries = computed(() => serialRows.value.map(row => normalizeAccessorySerial(row.value)).filter(Boolean)
  .map(serial_number => ({ serial_number, store_id: Number(formData.value.store_id) })))
const serialValidationError = computed(() => {
  const values = serialEntries.value.map(item => item.serial_number)
  if (values.some(value => !isValidAccessorySerial(value))) return 'SN只能包含字母、数字、点、横线、下划线或斜线，最多100位'
  if (new Set(values).size !== values.length) return '本次入库存在重复SN，请核对'
  if (values.length > 1000) return '本次最多录入1000条SN'
  return ''
})
const focusSerialRow = async (id: number) => {
  await nextTick()
  const root: HTMLElement | undefined = formRef.value?.$el
  root?.querySelector<HTMLInputElement>(`[data-serial-row="${id}"] input`)?.focus()
}
const addSerialRow = () => {
  if (!formData.value.store_id || serialRows.value.length >= 1000) return
  const id = ++nextSerialRowId
  serialRows.value.push({ id, value: '' })
  void focusSerialRow(id)
}
const focusNextSerial = (index: number) => {
  const next = serialRows.value[index + 1]
  if (next) void focusSerialRow(next.id)
  else if (serialRows.value[index]?.value.trim()) addSerialRow()
}
const removeSerialRow = (id: number) => { serialRows.value = serialRows.value.filter(row => row.id !== id) }
const clearSerialRows = () => { serialRows.value = isStockInMode.value && formData.value.serial_tracking === 1 ? [{ id: ++nextSerialRowId, value: '' }] : []; serialBatchInput.value = ''; serialScannerVisible.value = false }
const appendSerialBatch = () => {
  const values = serialBatchInput.value.split(/\r?\n/).map(normalizeAccessorySerial).filter(Boolean)
  const all = [...serialEntries.value.map(item => item.serial_number), ...values]
  if (all.length > 1000 || all.some(value => !isValidAccessorySerial(value)) || new Set(all).size !== all.length) {
    globalNotifications.warning('SN格式不正确、重复或超过1000条，请核对后再添加')
    return
  }
  for (const value of values) {
    const empty = serialRows.value.find(row => !row.value.trim())
    if (empty) empty.value = value
    else serialRows.value.push({ id: ++nextSerialRowId, value })
  }
  serialBatchInput.value = ''
}
const openSerialScanner = (id?: number) => {
  if (submitting.value || pendingStockIn.value) return
  serialScanTarget.value = id ?? null
  serialScannerVisible.value = true
}
const acceptSerialScan = (raw: string) => {
  const value = normalizeAccessorySerial(raw)
  const target = serialRows.value.find(row => row.id === serialScanTarget.value)
  if (!isValidAccessorySerial(value) || serialRows.value.some(row => row.id !== target?.id && normalizeAccessorySerial(row.value) === value)) {
    globalNotifications.warning('SN格式不正确或已录入，请重新扫描')
    return
  }
  if (target) target.value = value
  else {
    const empty = serialRows.value.find(row => !row.value.trim())
    if (empty) empty.value = value
    else if (serialRows.value.length < 1000) serialRows.value.push({ id: ++nextSerialRowId, value })
    else globalNotifications.warning('本次最多录入1000条SN')
  }
}
const normalizeAccessoryOption = (item: ReferenceRecord): AccessoryOption => ({
  id: Number(item.id || 0),
  name: String(item.name || ''),
  brand_id: item.brand_id === null || item.brand_id === undefined ? undefined : Number(item.brand_id),
  status: item.status,
  sort_order: Number(item.sort_order || 0)
})
const accessoryPayloadFieldMap: Record<string, AccessoryFieldName> = {
  barcode: 'barcode', accessory_id: 'name', name: 'name', category: 'category', category_id: 'category', product_model: 'product_model',
  usage_type: 'usage_type', serial_tracking: 'serial_tracking', serial_numbers: 'serial_number',
  brand_id: 'brand_name', model_id: 'model_name', model_ids: 'model_name', color_id: 'color_name', supplier_id: 'supplier_name',
  purchase_cost: 'purchase_cost', sale_price: 'sale_price', unit: 'unit', unit_id: 'unit',
  status: 'status', min_stock: 'min_stock', total_quantity: 'total_quantity', distribution: 'distribution',
  store_id: 'distribution', remarks: 'remarks', description: 'description', image_url: 'image_url'
}

const canRetryStockIn = computed(() => Boolean(pendingStockIn.value) && !recoveryError.value &&
  Object.keys(pendingStockIn.value || {}).every(key => key === 'request_key' ||
    Boolean(accessoryPayloadFieldMap[key] && canViewAccessoryField(accessoryPayloadFieldMap[key]))))

// 计算属性
const canSubmit = computed(() => {
  if (isStockInMode.value && recoveryError.value) return false
  if (searching.value || !optionsReady.value || optionsLoading.value || modelsLoading.value) return false
  if (isEditMode.value) {
    const editableFields = Object.values(accessoryPayloadFieldMap).some(canViewAccessoryField)
    return editableFields && (!canViewAccessoryField('name') || Boolean(formData.value.name))
  }
  if (props.archiveOnly) {
    return canViewAccessoryField('name') && Boolean(formData.value.name && formData.value.category_id && formData.value.unit_id)
  }
  if (formData.value.serial_tracking === 1 && (!canViewAccessoryField('serial_number') || serialEntries.value.length === 0 || serialEntries.value.length > 1000 || serialBatchInput.value.trim() || serialValidationError.value)) return false
  if (!['name', 'supplier_name', 'purchase_cost', 'total_quantity', 'distribution', 'usage_type'].every(field => canViewAccessoryField(field as AccessoryFieldName))) return false
  return (
    formData.value.accessory_id &&
    formData.value.name &&
    formData.value.category_id &&
    formData.value.unit_id &&
    formData.value.supplier_id &&
    formData.value.purchase_cost >= 0 &&
    (formData.value.serial_tracking === 1 ? serialEntries.value.length > 0 : formData.value.total_quantity > 0) &&
    formData.value.store_id
  )
})

// 图片上传配置
const uploadUrl = computed(() => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  return `${apiBaseUrl}/accessories/upload`
})

const uploadHeaders = computed(() => {
  const authData = storage.getAuth()
  const token = authStore.token || authData?.token || null
  return {
    Authorization: token ? `Bearer ${token}` : ''
  }
})

// 图片上传验证
const beforeImageUpload = (file: UploadRawFile): boolean => {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    globalNotifications.error('只能上传图片文件！')
    return false
  }
  if (!isLt2M) {
    globalNotifications.error('图片大小不能超过 2MB！')
    return false
  }
  return true
}

// 图片上传成功
const handleImageSuccess = (response: AccessoryImageUploadResponse): void => {
  if (response.success && response.data?.url) {
    formData.value.image_url = response.data.url
    if (!uploadedTempImages.value.includes(response.data.url)) {
      uploadedTempImages.value.push(response.data.url)
    }
    globalNotifications.success('图片上传成功')
  } else {
    globalNotifications.error('图片上传失败')
  }
}

// 图片上传失败
const handleUploadError = () => {
  globalNotifications.error('图片上传失败，请重试')
}

// 触发上传
const triggerUpload = () => {
  if (existingAccessory.value) return
  const uploadInput = document.querySelector<HTMLInputElement>('.image-uploader input[type="file"]')
  uploadInput?.click()
}

// 公共资料统一读取；手机型号只加载当前适配品牌，并丢弃过期响应。
const loadOptions = async () => {
  const requestId = ++optionsRequestId
  optionsLoading.value = true
  optionsReady.value = false
  try {
    const response = await getAccessoryEntryOptions({ accessory_id: formData.value.accessory_id || undefined })
    if (requestId !== optionsRequestId || !visible.value || !response.data) return
    const options = response.data
    optionsReady.value = true
    categories.value = options.categories.map(normalizeAccessoryOption)
    units.value = options.units.map(normalizeAccessoryOption)
    brands.value = options.brands.map(normalizeAccessoryOption)
    modelBrands.value = options.model_brands.map(normalizeAccessoryOption)
    colors.value = options.colors.map(normalizeAccessoryOption)
    suppliers.value = options.suppliers.map(normalizeAccessoryOption)
    stores.value = options.stores.map(store => ({
      id: Number(store.id), name: String(store.name || '')
    }))
    if (!stores.value.some(store => store.id === formData.value.store_id)) {
      formData.value.store_id = stores.value.find(store => store.id === options.default_store_id)?.id || stores.value.find(store => store.id === Number(authStore.user?.store_id))?.id || stores.value[0]?.id || null
    }
  } catch (err) {
    if (requestId !== optionsRequestId || !visible.value) return
    optionsReady.value = false
    logger.error('加载配件入库资料失败', err)
    globalNotifications.error(getRequestErrorMessage(err, '加载入库资料失败，请关闭后重试'))
  } finally {
    if (requestId === optionsRequestId) optionsLoading.value = false
  }
}

const loadModels = async () => {
  const requestId = ++modelRequestId
  models.value = []
  if (!canViewAccessoryField('model_name') || (!modelBrandId.value && !formData.value.model_ids.length)) {
    modelsLoading.value = false
    return
  }
  modelsLoading.value = true
  try {
    const response = await getAccessoryEntryOptions({
      brand_id: modelBrandId.value || undefined,
      accessory_id: formData.value.accessory_id || undefined,
      model_ids: formData.value.model_ids
    })
    if (requestId !== modelRequestId || !visible.value) return
    models.value = (response.data?.models || []).map(normalizeAccessoryOption)
  } catch (err) {
    if (requestId !== modelRequestId || !visible.value) return
    logger.error('加载适配型号失败', err)
    globalNotifications.error(getRequestErrorMessage(err, '加载适配型号失败'))
  } finally {
    if (requestId === modelRequestId) modelsLoading.value = false
  }
}

const applyAccessory = (accessory: AccessoryRecord) => {
  hydrating = true
  const value = <T,>(field: AccessoryFieldName, input: T, fallback: T): T => canViewAccessoryField(field) ? input : fallback
  Object.assign(formData.value, {
    accessory_id: accessory.id, id: accessory.id,
    barcode: value('barcode', accessory.barcode || '', ''),
    name: value('name', accessory.name || '', ''),
    category: value('category', accessory.category || '', ''),
    category_id: value('category', Number(accessory.category_id) || null, null),
    product_model: value('product_model', accessory.product_model || '', ''),
    serial_tracking: value('serial_tracking', Number(accessory.serial_tracking || 0), 0),
    brand_id: value('brand_name', Number(accessory.brand_id) || null, null),
    model_id: value('model_name', Number(accessory.model_id) || null, null),
    model_ids: value('model_name', Array.isArray(accessory.model_ids)
      ? accessory.model_ids.map(Number)
      : String(accessory.model_ids || (accessory.model_id ? accessory.model_id : '')).split(',').filter(Boolean).map(Number), []),
    color_id: value('color_name', Number(accessory.color_id) || null, null),
    supplier_id: value('supplier_name', Number(accessory.supplier_id) || null, null),
    purchase_cost: value('purchase_cost', Number(accessory.purchase_cost || 0), 0),
    sale_price: value('sale_price', Number(accessory.sale_price || 0), 0),
    unit: value('unit', accessory.unit || '个', '个'),
    unit_id: value('unit', Number(accessory.unit_id) || null, null),
    status: value('status', Number(accessory.status) === 0 ? 0 : 1, 1),
    min_stock: value('min_stock', Number(accessory.min_stock ?? 5), 5),
    image_url: value('image_url', accessory.image_url || '', ''),
    remarks: value('remarks', accessory.remarks || '', '')
  })
  modelBrandId.value = value('model_name', Number(accessory.model_brand_id) || null, null)
  hydrating = false
}

const fillStockInTemplate = async (accessory: AccessoryRecord, isLatest: () => boolean) => {
  if (canViewAccessoryField('status') && accessory.status !== undefined && Number(accessory.status) !== 1) {
    globalNotifications.warning('该商品模板已停用，请选择启用的模板')
    return
  }
  const supplierId = formData.value.supplier_id
  const purchaseCost = formData.value.purchase_cost
  const brandId = formData.value.brand_id
  const productModel = formData.value.product_model
  if (existingAccessory.value?.id !== accessory.id) {
    if (serialEntries.value.length || serialBatchInput.value.trim()) {
      const confirmed = await globalNotifications.confirm('切换商品模板将清空已录入的SN，是否继续？', '切换商品模板')
      if (!confirmed || !isLatest() || !visible.value) return
    }
    clearSerialRows()
  }
  existingAccessory.value = accessory
  applyAccessory(accessory)
  formData.value.supplier_id = supplierId
  formData.value.purchase_cost = purchaseCost
  formData.value.brand_id = brandId
  formData.value.product_model = productModel || formData.value.product_model
  await loadOptions()
  if (!isLatest() || !visible.value) return
  await loadModels()
}

const selectTemplate = async (id: number) => {
  if (isFixedTemplate.value || !Number.isSafeInteger(id) || id <= 0) return
  const request = accessorySelectionRequest.nextRequest()
  searching.value = true
  try {
    const response = await unifiedApi.get<AccessoryRecord>(`/accessories/${id}`, {
      signal: request.signal, useCache: false
    })
    if (!request.isLatest() || !visible.value || !response.data) return
    await fillStockInTemplate(response.data, request.isLatest)
  } catch (err) {
    if (!request.isLatest() || accessorySelectionRequest.isCanceledError(err)) return
    logger.error('读取商品模板失败', err)
  } finally {
    if (request.isLatest()) searching.value = false
  }
}

// 提交
const handleSubmit = async () => {
  if (submitting.value || (isStockInMode.value && purchaseStore.submitting)) return
  const isPurchase = isStockInMode.value
  const actorId = purchaseActorId.value
  let purchaseInput: AccessoryStockInInput | undefined
  if (pendingStockIn.value ? !canRetryStockIn.value : !canSubmit.value) {
    globalNotifications.warning(isEditMode.value || props.archiveOnly ? '请完善商品档案' : '请完善入库信息')
    return
  }

  if (isPurchase && !pendingStockIn.value && !formData.value.store_id) {
    globalNotifications.warning('请选择入库门店')
    return
  }
  submitting.value = true
  if (isPurchase) purchaseStore.submitting = true
  try {
    if (!pendingStockIn.value && !props.archiveOnly && formRef.value && !await formRef.value.validate().catch(() => false)) return
    if (isEditMode.value) {
      const templatePayload = buildAccessoryUpdatePayload(formData.value)
      delete templatePayload.purchase_cost
      delete templatePayload.supplier_id
      delete templatePayload.brand_id
      const updateData = pickVisibleAccessoryFields(templatePayload, accessoryPayloadFieldMap)
      const response = await unifiedApi.put(`/accessories/${formData.value.id}`, updateData)
      if (!response.success) throw new Error(response.message || '更新模板失败')
      globalNotifications.success('更新成功！')
    } else if (props.archiveOnly) {
      const archivePayload = buildAccessoryUpdatePayload(formData.value)
      delete archivePayload.purchase_cost
      delete archivePayload.supplier_id
      delete archivePayload.brand_id
      const archiveData = pickVisibleAccessoryFields(archivePayload, accessoryPayloadFieldMap)
      const response = await unifiedApi.post('/accessories', archiveData)
      if (!response.success) throw new Error(response.message || '创建模板失败')
      globalNotifications.success('商品模板创建成功！')
    } else {
      const data = pickVisibleAccessoryFields(buildAccessoryStockInPayload({
        ...formData.value,
        total_quantity: formData.value.serial_tracking === 1 ? serialEntries.value.length : formData.value.total_quantity,
        serial_numbers: formData.value.serial_tracking === 1 ? serialEntries.value : undefined,
        distribution: []
      }), accessoryPayloadFieldMap)

      purchaseInput = purchaseStore.prepare(actorId, data)
      await fieldPermissions.init()
      if (purchaseActorId.value !== actorId || !canRetryStockIn.value) throw new Error('入库账号或字段权限已变化，请重新核对权限后重试原入库')
      const response = await unifiedApi.post<AccessoryStockInReceipt>('/accessories/stock-in', purchaseInput)
      if (!response.success || !isAccessoryStockInReceipt(response.data)) throw new Error('入库回执未确认，请重试原入库核对结果')
      purchaseStore.complete(actorId, purchaseInput.request_key)
      if (purchaseActorId.value !== actorId) return
      globalNotifications.success(response.data.replayed ? '已核对原采购入库，未重复入库！' : '入库成功！')
    }
    uploadedTempImages.value = []
    visible.value = false
    emit('success')
  } catch (err) {
    const code = getRequestErrorPayload(err)?.code
    // 仅服务端明确拒绝且未提交的业务错误可释放原请求；网络/5xx/结构缺失继续保留。
    if (purchaseInput && getRequestErrorStatus(err) === 400 && typeof code === 'string' &&
      ['VALIDATION_ERROR', 'INVALID_REFERENCE', 'NOT_FOUND', 'DUPLICATE_SERIAL', 'SERIAL_STORE_MISMATCH', 'SERIAL_DISTRIBUTION_MISMATCH'].includes(code)) {
      try { purchaseStore.complete(actorId, purchaseInput.request_key) }
      catch (storageError) { logger.error('无法清理已拒绝入库的防重凭据，保留原请求供重试', storageError) }
    }
    logger.error(isEditMode.value ? '更新失败' : '入库失败', err)
    globalNotifications.error(getRequestErrorMessage(err, `${isEditMode.value ? '更新失败' : props.archiveOnly ? '创建档案失败' : '入库失败'}，请重试`))
  } finally {
    submitting.value = false
    if (isPurchase) purchaseStore.submitting = false
  }
}

const handleDialogClose = async () => {
  await cleanupTempImages()
  resetFormData()
}

const handleClose = () => {
  if (submitting.value) return
  visible.value = false
}

const cleanupTempImages = async () => {
  if (uploadedTempImages.value.length === 0) return
  const targets = [...uploadedTempImages.value]
  const success = await deleteTempFiles(targets)
  if (success) {
    uploadedTempImages.value = uploadedTempImages.value.filter(url => !targets.includes(url))
  }
}

const resetFormData = () => {
  templateSearchRequest.cancelLatest()
  templateResults.value = []
  templatePage.value = 1
  templateTotal.value = 0
  templateKeyword.value = ''
  templatesLoading.value = false
  accessorySelectionRequest.cancelLatest()
  searching.value = false
  formData.value = {
    barcode: '',
    accessory_id: null,
    id: null,
    name: '',
    category: '',
    category_id: null,
    product_model: '',
    serial_tracking: 0,
    usage_type: 'sale' as AccessoryUsageType,
    brand_id: null,
    model_id: null,
    model_ids: [],
    color_id: null,
    supplier_id: null,
    purchase_cost: 0,
    sale_price: 0,
    unit: '个',
    unit_id: null,
    status: 1,
    min_stock: 5,
    image_url: '',
    total_quantity: 1,
    store_id: null,
    remarks: ''
  }
  existingAccessory.value = null
  clearSerialRows()
  hydrating = true
  modelBrandId.value = null
  hydrating = false
  models.value = []
  uploadedTempImages.value = []

}

watch(() => [isStockInMode.value, formData.value.serial_tracking] as const, ([stockIn, tracking]) => {
  serialScannerVisible.value = false
  if (stockIn && tracking === 1 && !serialRows.value.length) serialRows.value.push({ id: ++nextSerialRowId, value: '' })
})

watch(modelBrandId, brandId => {
  if (hydrating) return
  if (!brandId) {
    formData.value.model_ids = []
    formData.value.model_id = null
  }
  void loadModels()
}, { flush: 'sync' })

watch(() => props.modelValue, async isOpen => {
  if (!isOpen) {
    serialScannerVisible.value = false
    optionsRequestId++
    modelRequestId++
    templateSearchRequest.cancelLatest()
    templatesLoading.value = false
    accessorySelectionRequest.cancelLatest()
    searching.value = false
    return
  }
  await fieldPermissions.init()
  if (!visible.value) return
  recoveryError.value = ''
  if (isStockInMode.value) {
    try { purchaseStore.load(purchaseActorId.value) }
    catch (error) { recoveryError.value = getRequestErrorMessage(error) }
  }
  resetFormData()
  if (props.accessory?.id) {
    applyAccessory(props.accessory)
    if (props.stockInOnly) {
      existingAccessory.value = props.accessory
      formData.value.supplier_id = null
      formData.value.purchase_cost = 0
      if (!props.accessory.template_id) {
        formData.value.brand_id = null
      }
    }
  }
  await loadOptions()
  await loadModels()
}, { immediate: true })
</script>

<style scoped src="./styles/accessory-stock-in-modal/form.css"></style>
<style scoped src="./styles/accessory-stock-in-modal/responsive.css"></style>
