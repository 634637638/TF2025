<template>
  <MobileDialog
    v-model="visible"
    title="编辑设备信息"
    width="900px"
    :close-on-click-modal="false"
    dialog-class="sales-edit-dialog"
    :show-default-footer="false"
  >
    <div class="edit-phone-dialog">
      <div class="info-cards-container">
        <div
          v-if="canViewField('brand')"
          class="info-card"
        >
          <div class="card-icon brand">
            <i class="fas fa-tag" />
          </div>
          <div class="card-details">
            <div class="card-label">
              品牌
            </div>
            <div class="card-primary-text">
              {{ editForm.brand || '未设置' }}
            </div>
          </div>
        </div>

        <div
          v-if="canViewField('model')"
          class="info-card"
        >
          <div class="card-icon model">
            <i class="fas fa-mobile-screen" />
          </div>
          <div class="card-details">
            <div class="card-label">
              型号
            </div>
            <div class="card-primary-text">
              {{ editForm.model || '未设置' }}
            </div>
          </div>
        </div>

        <div
          v-if="canViewField('color')"
          class="info-card"
        >
          <div class="card-icon color">
            <i class="fas fa-palette" />
          </div>
          <div class="card-details">
            <div class="card-label">
              颜色
            </div>
            <div class="card-primary-text">
              {{ editForm.color || '未设置' }}
            </div>
          </div>
        </div>

        <div
          v-if="canViewField('memory')"
          class="info-card"
        >
          <div class="card-icon memory">
            <i class="fas fa-memory" />
          </div>
          <div class="card-details">
            <div class="card-label">
              内存
            </div>
            <div class="card-primary-text">
              {{ editForm.memory || '未设置' }}
            </div>
          </div>
        </div>

        <div
          v-if="canViewField('serial_number')"
          class="info-card"
        >
          <div class="card-icon serial">
            <i class="fas fa-barcode" />
          </div>
          <div class="card-details">
            <div class="card-label">
              序列号
            </div>
            <div class="card-primary-text small-text">
              {{ editForm.serial_number || '未设置' }}
            </div>
          </div>
        </div>

        <div
          v-if="canViewPrice"
          class="info-card"
        >
          <div class="card-icon price">
            <i class="fas fa-yen-sign" />
          </div>
          <div class="card-details">
            <div class="card-label">
              入库价格
            </div>
            <div class="card-primary-text">
              {{ editForm.purchase_cost ? `¥${Math.round(editForm.purchase_cost)}` : '未定价' }}
            </div>
          </div>
        </div>
      </div>

      <div class="sales-edit-form-shell">
        <div class="sales-edit-form-grid">
          <div v-if="canViewField('supplier_name')">
            <label class="sales-edit-field-label">供应商</label>
            <el-select
              v-model="editForm.supplier_id"
              placeholder="选择供应商"
              filterable
              clearable
              teleported
              popper-class="tf2025-form-popper"
              class="full-width"
              :disabled="!canEditField('supplier_name')"
            >
              <el-option
                v-for="supplier in suppliers"
                :key="supplier.id"
                :label="supplier.name"
                :value="supplier.id"
              />
            </el-select>
          </div>

          <div v-if="canViewField('store_name')">
            <label class="sales-edit-field-label">入库店铺</label>
            <el-select
              v-model="editForm.store_id"
              placeholder="选择店铺"
              filterable
              clearable
              teleported
              popper-class="tf2025-form-popper"
              class="full-width"
              :disabled="!canEditField('store_name')"
            >
              <el-option
                v-for="store in stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
          </div>

          <div v-if="canViewField('inventory_time')">
            <label class="sales-edit-field-label">入库时间</label>
            <el-date-picker
              v-model="editForm.inventory_time"
              type="date"
              placeholder="选择日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              teleported
              popper-class="tf2025-form-popper"
              style="width: 140px"
              :disabled="!canEditField('inventory_time')"
            />
          </div>

          <div v-if="canViewField('condition')">
            <label class="sales-edit-field-label">机况</label>
            <el-select
              v-model="editForm.condition"
              placeholder="选择机况"
              teleported
              popper-class="tf2025-form-popper"
              class="full-width"
              :disabled="!canEditField('condition')"
            >
              <el-option
                label="全新"
                value="全新"
              />
              <el-option
                label="二手"
                value="二手"
              />
            </el-select>
          </div>

          <div v-if="canViewField('brand')">
            <label class="sales-edit-field-label">品牌</label>
            <el-select
              v-model="editForm.brand"
              placeholder="选择品牌"
              filterable
              clearable
              teleported
              popper-class="tf2025-form-popper"
              class="full-width"
              :disabled="!canEditField('brand')"
              @change="emit('brand-change')"
            >
              <el-option
                v-for="brand in brands"
                :key="brand.id"
                :label="brand.name"
                :value="brand.name"
              />
            </el-select>
          </div>

          <div v-if="canViewField('model')">
            <label class="sales-edit-field-label">型号</label>
            <el-select
              v-if="editForm.brand && editBrandModels.length > 0"
              v-model="editForm.model"
              placeholder="选择型号"
              filterable
              clearable
              teleported
              popper-class="tf2025-form-popper"
              :disabled="!canEditField('model') || (!editForm.brand && editBrandModels.length === 0)"
              class="full-width"
            >
              <el-option
                v-for="model in editBrandModels"
                :key="model"
                :label="model"
                :value="model"
              />
            </el-select>
            <el-input
              v-else
              v-model="editForm.model"
              placeholder="请输入型号"
              class="full-width"
              :disabled="!canEditField('model')"
            />
          </div>

          <div v-if="canViewField('color')">
            <label class="sales-edit-field-label">颜色</label>
            <el-select
              v-model="editForm.color"
              placeholder="选择颜色"
              filterable
              clearable
              teleported
              popper-class="tf2025-form-popper"
              class="full-width"
              :disabled="!canEditField('color')"
            >
              <el-option
                v-for="color in colors"
                :key="color"
                :label="color"
                :value="color"
              />
            </el-select>
          </div>

          <div v-if="canViewField('memory')">
            <label class="sales-edit-field-label">内存</label>
            <el-select
              v-model="editForm.memory"
              placeholder="选择内存"
              filterable
              clearable
              teleported
              popper-class="tf2025-form-popper"
              class="full-width"
              :disabled="!canEditField('memory')"
            >
              <el-option
                v-for="memory in memories"
                :key="memory"
                :label="memory"
                :value="memory"
              />
            </el-select>
          </div>

          <div v-if="canViewField('serial_number')">
            <label class="sales-edit-field-label">序列号</label>
            <el-input
              v-model="editForm.serial_number"
              placeholder="请输入序列号（仅字母数字）"
              maxlength="18"
              class="full-width"
              :disabled="!canEditField('serial_number')"
              @input="value => emit('serial-number-input', value)"
            />
          </div>

          <div
            v-if="canViewField('imei')"
            class="sales-edit-imei-field"
          >
            <label class="sales-edit-field-label">
              IMEI
              <span
                v-if="isNoImeiMode"
                class="sales-edit-imei-badge"
              >
                <i class="fas fa-check-circle" /> 无IMEI
              </span>
            </label>
            <div
              class="cursor-pointer"
              :title="isNoImeiMode ? '双击切换回标准模式' : '双击启用无IMEI模式（支持字母+数字）'"
              @dblclick="emit('toggle-no-imei')"
            >
              <el-input
                v-model="editForm.imei"
                :placeholder="isNoImeiMode ? '无IMEI模式' : '请输入IMEI'"
                :maxlength="isNoImeiMode ? 30 : 15"
                class="full-width"
                :disabled="!canEditField('imei')"
                @input="value => emit('imei-input', value)"
              >
                <template
                  v-if="isNoImeiMode"
                  #suffix
                >
                  <span class="sales-edit-imei-suffix">
                    <i class="fas fa-check-circle" /> 无IMEI
                  </span>
                </template>
              </el-input>
            </div>
            <div
              v-if="isNoImeiMode"
              class="sales-edit-imei-hint"
            >
              双击输入框可切换回标准模式
            </div>
          </div>

          <div
            v-if="canViewPrice"
            class="sales-edit-price-field"
          >
            <label class="sales-edit-field-label">入库价格</label>
            <el-input-number
              v-model="editForm.purchase_cost"
              placeholder="请输入入库价格"
              :min="0"
              :step="1"
              :precision="0"
              :controls="false"
              class="full-width"
              :value-on-clear="null"
              :disabled="!canEditField('purchase_cost')"
            />
          </div>

          <div
            v-if="canViewField('remarks')"
            class="sales-edit-remarks-field"
          >
            <label class="sales-edit-field-label">备注</label>
            <el-input
              v-model="editForm.remarks"
              type="textarea"
              :rows="2"
              placeholder="请输入备注信息"
              maxlength="500"
              show-word-limit
              class="full-width"
              :disabled="!canEditField('remarks')"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button
          type="default"
          @click="emit('cancel')"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="emit('submit')"
        >
          保存修改
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'
import type { PhoneBrand } from '@/types'
import type {
  SalesEditForm,
  SalesStoreOption,
  SalesSupplierOption
} from '../types'

const props = defineProps<{
  modelValue: boolean
  form: SalesEditForm
  suppliers: SalesSupplierOption[]
  stores: SalesStoreOption[]
  brands: Array<Pick<PhoneBrand, 'id' | 'name'> & { sort_order?: number }>
  editBrandModels: string[]
  colors: string[]
  memories: string[]
  isNoImeiMode: boolean
  canViewField: (_fieldName: string) => boolean
  canEditField: (_fieldName: string) => boolean
  canViewPrice: boolean
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'brand-change': []
  'serial-number-input': [value: string]
  'imei-input': [value: string]
  'toggle-no-imei': []
  cancel: []
  submit: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})
const editForm = props.form
const canViewField = (fieldName: string) => props.canViewField(fieldName)
const canEditField = (fieldName: string) => props.canEditField(fieldName)
</script>

<style scoped lang="scss" src="../styles/sales-edit-phone-dialog.scss"></style>
