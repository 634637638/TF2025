<template>
  <!-- 编辑设备对话框 -->
  <MobileDialog
    :model-value="modelValue"
    title="编辑设备信息"
    width="900px"
    dialog-class="inventory-edit-dialog"
    :close-on-click-modal="false"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="inventory-edit-content">
      <!-- 基本信息 -->
      <div class="inventory-edit-summary-grid">
        <div
          v-if="canViewField('brand')"
          class="bg-gradient-brand"
        >
          <div class="text-xs opacity-80 mb-1">
            品牌
          </div>
          <div class="text-base font-semibold">
            {{ editForm.brand || '未设置' }}
          </div>
        </div>
        <div
          v-if="canViewField('model')"
          class="bg-gradient-model"
        >
          <div class="text-xs opacity-80 mb-1">
            型号
          </div>
          <div class="text-base font-semibold">
            {{ editForm.model || '未设置' }}
          </div>
        </div>
        <div
          v-if="canViewField('color')"
          class="bg-gradient-color"
        >
          <div class="text-xs opacity-80 mb-1">
            颜色
          </div>
          <div class="text-base font-semibold">
            {{ editForm.color || '未设置' }}
          </div>
        </div>
        <div
          v-if="canViewField('memory')"
          class="bg-gradient-memory"
        >
          <div class="text-xs opacity-80 mb-1">
            内存
          </div>
          <div class="text-base font-semibold">
            {{ editForm.memory || '未设置' }}
          </div>
        </div>
        <div
          v-if="canViewField('serial_number')"
          class="bg-gradient-serial"
        >
          <div class="text-xs opacity-80 mb-1">
            序列号
          </div>
          <div class="text-sm font-semibold">
            {{ editForm.serial_number || '未设置' }}
          </div>
        </div>
        <div
          v-if="canViewField('purchase_cost')"
          class="bg-gradient-purchase"
        >
          <div class="text-xs opacity-80 mb-1">
            入库价格
          </div>
          <div class="text-base font-semibold">
            {{ editForm.purchase_cost ? `¥${Math.round(editForm.purchase_cost)}` : '未定价' }}
          </div>
        </div>
      </div>

      <!-- 编辑表单 -->
      <div class="inventory-edit-form-shell">
        <div class="inventory-edit-form-grid">
          <!-- 供应商 -->
          <div v-if="canViewField('supplier_name')">
            <label class="form-label">供应商</label>
            <el-select
              v-model="editForm.supplier_id"
              placeholder="选择供应商"
              filterable
              clearable
              reserve-keyword
              default-first-option
              teleported
              fit-input-width
              popper-class="tf2025-form-popper"
              class="w-full"
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

          <!-- 入库店铺 -->
          <div v-if="canViewField('store_name')">
            <label class="form-label">入库店铺</label>
            <el-select
              v-model="editForm.store_id"
              placeholder="选择店铺"
              filterable
              clearable
              reserve-keyword
              default-first-option
              teleported
              fit-input-width
              popper-class="tf2025-form-popper"
              class="w-full"
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

          <!-- 入库时间 -->
          <div v-if="canViewField('inventory_time')">
            <label class="form-label">入库时间</label>
            <el-date-picker
              v-model="editForm.inventory_time"
              type="date"
              placeholder="选择日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              teleported
              popper-class="tf2025-form-popper"
              class="w-full"
              :disabled="!canEditField('inventory_time')"
              :prefix-icon="null"
              :clearable="false"
            />
          </div>

          <!-- 机况 -->
          <div v-if="canViewField('is_new')">
            <label class="form-label">机况</label>
            <el-select
              v-model="editForm.condition"
              placeholder="选择机况"
              filterable
              reserve-keyword
              default-first-option
              teleported
              fit-input-width
              popper-class="tf2025-form-popper"
              class="w-full"
              :disabled="!canEditField('is_new')"
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

          <div>
            <label class="form-label">状态</label>
            <el-select
              v-model="editForm.status"
              placeholder="选择状态"
              teleported
              fit-input-width
              popper-class="tf2025-form-popper"
              class="w-full"
            >
              <el-option
                v-for="option in phoneStatusOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>

          <!-- 品牌 -->
          <div v-if="canViewField('brand')">
            <label class="form-label">品牌</label>
            <el-select
              v-model="editForm.brand"
              placeholder="选择品牌"
              filterable
              clearable
              reserve-keyword
              default-first-option
              teleported
              fit-input-width
              popper-class="tf2025-form-popper"
              class="w-full"
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

          <!-- 型号 -->
          <div v-if="canViewField('model')">
            <label class="form-label">型号</label>
            <el-select
              v-if="editForm.brand && brandModels.length > 0"
              v-model="editForm.model"
              placeholder="选择型号或输入搜索"
              filterable
              clearable
              allow-create
              remote
              reserve-keyword
              default-first-option
              remote-show-suffix
              teleported
              fit-input-width
              popper-class="tf2025-form-popper"
              :remote-method="remoteSearchModel"
              :loading="modelSearchLoading"
              :disabled="!canEditField('model')"
              class="w-full"
            >
              <el-option
                v-for="model in brandModels"
                :key="model"
                :label="model"
                :value="model"
              />
            </el-select>
            <el-input
              v-else
              v-model="editForm.model"
              placeholder="请输入型号（或先选择品牌）"
              clearable
              :disabled="!canEditField('model')"
              class="w-full"
            />
          </div>

          <!-- 颜色 -->
          <div v-if="canViewField('color')">
            <label class="form-label">颜色</label>
            <el-select
              v-model="editForm.color"
              placeholder="选择颜色"
              filterable
              clearable
              reserve-keyword
              default-first-option
              teleported
              fit-input-width
              popper-class="tf2025-form-popper"
              class="w-full"
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

          <!-- 内存 -->
          <div v-if="canViewField('memory')">
            <label class="form-label">内存</label>
            <el-select
              v-model="editForm.memory"
              placeholder="选择内存"
              filterable
              clearable
              reserve-keyword
              default-first-option
              teleported
              fit-input-width
              popper-class="tf2025-form-popper"
              class="w-full"
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

          <!-- 序列号和IMEI（手机端一行展示） -->
          <div
            v-if="canViewField('serial_number') || canViewField('imei')"
            class="inventory-edit-serial-imei-row"
          >
            <!-- 序列号 -->
            <div
              v-if="canViewField('serial_number')"
              class="inventory-edit-serial-field"
            >
              <label class="form-label">序列号</label>
              <el-input
                v-model="editForm.serial_number"
                placeholder="请输入序列号"
                maxlength="18"
                :disabled="!canEditField('serial_number')"
              />
            </div>

            <!-- IMEI -->
            <div
              v-if="canViewField('imei')"
              class="inventory-edit-imei-field"
            >
              <label class="form-label">
                IMEI
                <span
                  v-if="noImeiMode"
                  class="text-success text-xs ml-2"
                >
                  <i class="fas fa-check-circle" /> 无IMEI模式
                </span>
              </label>
              <div
                class="cursor-pointer"
                :title="noImeiMode ? '双击切换回标准模式' : '双击启用无IMEI模式（支持字母+数字）'"
                @dblclick="emit('toggle-no-imei')"
              >
                <el-input
                  v-model="editForm.imei"
                  :placeholder="noImeiMode ? '无IMEI模式' : '请输入15位IMEI'"
                  :maxlength="noImeiMode ? 30 : 15"
                  :disabled="!canEditField('imei')"
                  @input="emit('format-imei')"
                />
              </div>
              <div
                v-if="noImeiMode"
                class="text-xs text-gray-500 mt-1"
              >
                双击输入框可切换回标准模式
              </div>
            </div>
          </div>

          <!-- 入库价格 -->
          <div
            v-if="canViewField('purchase_cost')"
            class="inventory-edit-price-field"
          >
            <label class="form-label">入库价格</label>
            <div class="inventory-edit-price-row">
              <el-input-number
                v-model="editForm.purchase_cost"
                placeholder="请输入入库价格"
                :min="0"
                :step="1"
                :precision="0"
                :controls="false"
                class="inventory-edit-price-input"
                :value-on-clear="null"
                :disabled="!canEditField('purchase_cost')"
              />

              <!-- H5上架开关（全新机和二手商品通用） -->
              <div class="inventory-edit-publish-actions">
                <el-switch
                  v-model="editForm.is_published"
                  :active-value="1"
                  :inactive-value="0"
                  active-text="H5上架"
                  inactive-text="已下架"
                  inline-prompt
                  @change="handlePublishChange"
                />
              </div>
            </div>
          </div>

          <!-- 备注 -->
          <div
            v-if="canViewField('remarks')"
            class="inventory-edit-remarks-field"
          >
            <label class="form-label">备注</label>
            <el-input
              v-model="editForm.remarks"
              type="textarea"
              :rows="2"
              placeholder="请输入备注信息"
              maxlength="500"
              show-word-limit
              :disabled="!canEditField('remarks')"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div
        class="tf-dialog-actions inventory-edit-footer"
        :class="{ 'has-config': editForm.condition === '二手' }"
      >
        <el-button
          v-if="editForm.condition === '二手'"
          type="success"
          @click="emit('open-config')"
        >
          <i class="fas fa-mobile-alt" />
          商品配置
        </el-button>
        <el-button
          type="default"
          @click="emit('close')"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="emit('submit')"
        >
          <i
            v-if="!submitting"
            class="fas fa-save"
          />
          保存修改
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import MobileDialog from '@/components/MobileDialog.vue'

export interface InventoryEditForm {
  brand_id: number | null
  brand: string
  color_id: number | null
  color: string
  condition: string
  imageHover: boolean
  imei: string
  inventory_time: string | null
  is_published: number
  memory_id: number | null
  memory: string
  model_id: number | null
  model: string
  purchase_cost: number | null
  remarks: string
  serial_number: string
  status: string
  store_id: number | null
  supplier_id: number | null
}

interface NamedOption {
  id: number
  name: string
}

interface PhoneStatusOption {
  label: string
  value: string
}

defineProps<{
  brandModels: string[]
  brands: NamedOption[]
  canEditField: (_field: string) => boolean
  canViewField: (_field: string) => boolean
  colors: string[]
  editForm: InventoryEditForm
  memories: string[]
  modelSearchLoading: boolean
  modelValue: boolean
  noImeiMode: boolean
  phoneStatusOptions: readonly PhoneStatusOption[]
  remoteSearchModel: (_query: string) => void | Promise<void>
  stores: NamedOption[]
  submitting: boolean
  suppliers: NamedOption[]
}>()

const emit = defineEmits<{
  'brand-change': []
  close: []
  'format-imei': []
  'open-config': []
  'publish-change': [value: number]
  submit: []
  'toggle-no-imei': []
  'update:modelValue': [value: boolean]
}>()

const handlePublishChange = (value: string | number | boolean) => {
  emit('publish-change', Number(value))
}
</script>

