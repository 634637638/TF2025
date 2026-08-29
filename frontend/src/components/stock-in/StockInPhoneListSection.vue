<template>
  <section class="stock-in-section stock-in-phone-list">
    <header class="stock-in-section__header phone-list-header">
      <div class="phone-list-title">
        <h3 class="stock-in-section__title">
          商品明细
        </h3>
        <span class="phone-count">{{ formData.phones.length }} 件</span>
      </div>
      <div class="phone-list-actions">
        <el-button
          type="primary"
          size="small"
          @click="emit('add')"
        >
          <i class="fas fa-plus" />
          添加单条
        </el-button>
        <el-button
          type="success"
          size="small"
          @click="emit('batch')"
        >
          <i class="fas fa-layer-group" />
          批量添加
        </el-button>
        <el-button
          v-if="formData.phones.length > 1"
          type="danger"
          size="small"
          @click="emit('clear')"
        >
          <i class="fas fa-trash-alt" />
          清空
        </el-button>
      </div>
    </header>

    <div class="stock-in-section__body phone-list-body">
      <div
        v-if="!isMobile"
        class="batch-table-container"
      >
        <el-table
          :data="formData.phones"
          border
          stripe
          class="data-table devices-table compact-fit-table stock-in-data-table"
          table-layout="fixed"
          :fit="true"
          max-height="60vh"
          :row-class-name="getRowClassName"
        >
          <el-table-column
            type="index"
            label="#"
            width="54"
            align="center"
          />

          <el-table-column
            label="品牌"
            min-width="120"
            align="center"
          >
            <template #header>
              品牌 <span class="required">*</span>
            </template>
            <template #default="{ row: phone, $index: index }">
              <el-select
                v-model="phone.brand"
                placeholder="选择品牌"
                filterable
                :filter-method="(query) => handleBrandFilter(query, index)"
                clearable
                size="small"
                @change="handleBrandChange(phone)"
              >
                <el-option
                  v-for="brand in getFilteredBrandsForPhone(index)"
                  :key="brand.id"
                  :label="brand.name"
                  :value="brand.id"
                />
              </el-select>
            </template>
          </el-table-column>

          <el-table-column
            label="型号"
            min-width="160"
            align="center"
          >
            <template #header>
              型号 <span class="required">*</span>
            </template>
            <template #default="{ row: phone, $index: index }">
              <el-select
                v-model="phone.model"
                placeholder="选择型号"
                filterable
                :filter-method="(query) => handleModelFilter(query, index)"
                clearable
                :disabled="!phone.brand"
                size="small"
                popper-class="tf2025-form-popper"
              >
                <el-option
                  v-for="model in getFilteredModelsForPhone(index)"
                  :key="`${model.id}-${cacheVersion}`"
                  :label="model.name"
                  :value="model.id"
                />
              </el-select>
            </template>
          </el-table-column>

          <el-table-column
            label="颜色"
            min-width="110"
            align="center"
          >
            <template #header>
              颜色 <span class="required">*</span>
            </template>
            <template #default="{ row: phone, $index: index }">
              <el-select
                v-model="phone.color"
                placeholder="选择颜色"
                filterable
                :filter-method="(query) => handleColorFilter(query, index)"
                clearable
                size="small"
              >
                <el-option
                  v-for="color in getFilteredColorsForPhone(index)"
                  :key="color.id"
                  :label="color.name"
                  :value="color.id"
                />
              </el-select>
            </template>
          </el-table-column>

          <el-table-column
            label="内存"
            min-width="110"
            align="center"
          >
            <template #header>
              内存 <span class="required">*</span>
            </template>
            <template #default="{ row: phone, $index: index }">
              <el-select
                v-model="phone.memory"
                placeholder="选择内存"
                filterable
                :filter-method="(query) => handleMemoryFilter(query, index)"
                clearable
                size="small"
              >
                <el-option
                  v-for="memory in getFilteredMemoriesForPhone(index)"
                  :key="memory.id"
                  :label="memory.size || memory.name || memory.capacity"
                  :value="memory.id"
                />
              </el-select>
            </template>
          </el-table-column>

          <el-table-column
            label="序列号"
            min-width="160"
            align="center"
          >
            <template #header>
              序列号 <span class="required">*</span>
            </template>
            <template #default="{ row: phone }">
              <el-input
                v-model="phone.serial_number"
                placeholder="序列号"
                maxlength="30"
                size="small"
                @input="formatSerialNumber(phone)"
              />
            </template>
          </el-table-column>

          <el-table-column
            label="IMEI"
            min-width="170"
            align="center"
          >
            <template #header>
              IMEI <span class="required">*</span>
            </template>
            <template #default="{ row: phone }">
              <div
                class="cursor-pointer"
                @dblclick="handleImeiDoubleClick(phone)"
                @touchend.stop="handleImeiTouchEnd(phone, $event)"
              >
                <el-input
                  v-model="phone.imei"
                  :placeholder="phone.isNoIMEIMode ? '无IMEI' : 'IMEI'"
                  :maxlength="phone.isNoIMEIMode ? 30 : 15"
                  size="small"
                  @input="formatImei(phone)"
                />
              </div>
            </template>
          </el-table-column>

          <el-table-column
            label="入库价格"
            min-width="120"
            align="center"
          >
            <template #header>
              入库价格 <span class="required">*</span>
            </template>
            <template #default="{ row: phone }">
              <el-input
                :model-value="formatPriceValue(phone.purchase_cost)"
                placeholder="价格"
                clearable
                inputmode="decimal"
                size="small"
                @input="updatePurchasePrice(phone, $event)"
              />
            </template>
          </el-table-column>

          <el-table-column
            label="操作"
            width="78"
            align="center"
            class-name="compact-action-column"
          >
            <template #default="{ $index: index }">
              <el-button
                v-if="formData.phones.length > 1"
                type="danger"
                size="small"
                class="table-action table-action--delete"
                title="删除商品"
                @click.stop="removePhone(index)"
              >
                <i class="fas fa-trash-alt" />
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div
        v-else
        class="modern-phone-list"
      >
        <div
          v-for="(phone, index) in formData.phones"
          :key="index"
          class="modern-phone-item"
        >
          <div class="phone-header">
            <span class="phone-number">商品 #{{ index + 1 }}</span>
            <el-button
              v-if="formData.phones.length > 1"
              type="danger"
              size="small"
              circle
              class="table-action--delete"
              title="删除商品"
              aria-label="删除商品"
              @click.stop="removePhone(index)"
            >
              <i class="fas fa-times" />
            </el-button>
          </div>

          <div class="phone-grid">
            <div class="grid-row">
              <el-form-item
                label="品牌"
                :prop="`phones.${index}.brand`"
              >
                <el-select
                  v-model="phone.brand"
                  placeholder="请选择或输入品牌"
                  filterable
                  :filter-method="(query) => handleBrandFilter(query, index)"
                  clearable
                  teleported
                  popper-class="tf2025-form-popper"
                  @change="handleBrandChange(phone)"
                >
                  <el-option
                    v-for="brand in getFilteredBrandsForPhone(index)"
                    :key="brand.id"
                    :label="brand.name"
                    :value="brand.id"
                  />
                </el-select>
              </el-form-item>

              <el-form-item
                label="型号"
                :prop="`phones.${index}.model`"
              >
                <el-select
                  v-model="phone.model"
                  placeholder="请选择或输入型号"
                  :disabled="!phone.brand"
                  clearable
                  filterable
                  :filter-method="(query) => handleModelFilter(query, index)"
                  teleported
                  popper-class="tf2025-form-popper"
                >
                  <el-option
                    v-for="model in getFilteredModelsForPhone(index)"
                    :key="`${model.id}-${cacheVersion}`"
                    :label="model.name"
                    :value="model.id"
                  />
                </el-select>
              </el-form-item>
            </div>

            <div class="grid-row">
              <el-form-item
                label="颜色"
                :prop="`phones.${index}.color`"
              >
                <el-select
                  v-model="phone.color"
                  placeholder="请选择或输入颜色"
                  clearable
                  filterable
                  :filter-method="(query) => handleColorFilter(query, index)"
                  teleported
                  popper-class="tf2025-form-popper"
                >
                  <el-option
                    v-for="color in getFilteredColorsForPhone(index)"
                    :key="color.id"
                    :label="color.name"
                    :value="color.id"
                  />
                </el-select>
              </el-form-item>

              <el-form-item
                label="内存"
                :prop="`phones.${index}.memory`"
              >
                <el-select
                  v-model="phone.memory"
                  placeholder="请选择或输入内存"
                  clearable
                  filterable
                  :filter-method="(query) => handleMemoryFilter(query, index)"
                  teleported
                  popper-class="tf2025-form-popper"
                >
                  <el-option
                    v-for="memory in getFilteredMemoriesForPhone(index)"
                    :key="memory.id"
                    :label="memory.size || memory.name || memory.capacity"
                    :value="memory.id"
                  />
                </el-select>
              </el-form-item>
            </div>

            <div class="grid-row single-column">
              <el-form-item
                label="序列号"
                :prop="`phones.${index}.serial_number`"
              >
                <div class="long-input-field">
                  <el-input
                    v-model="phone.serial_number"
                    placeholder="请输入序列号"
                    clearable
                    @input="formatSerialNumber(phone)"
                    @blur="validateSerialOnBlur(phone)"
                  >
                    <template
                      v-if="isMobile"
                      #suffix
                    >
                      <el-button
                        link
                        type="primary"
                        title="扫码识别序列号"
                        @click="scanSerialNumber(phone)"
                      >
                        <i class="fas fa-qrcode" />
                      </el-button>
                    </template>
                  </el-input>
                </div>
                <div
                  v-if="phone.serialValid === false"
                  class="error-message"
                >
                  序列号为4-30位字母、数字、斜杠或连字符
                </div>
              </el-form-item>
            </div>

            <div class="grid-row single-column">
              <el-form-item
                label="IMEI号"
                :prop="`phones.${index}.imei`"
              >
                <div
                  class="long-input-field imei-field"
                  @dblclick="handleImeiDoubleClick(phone)"
                  @touchend.stop="handleImeiTouchEnd(phone, $event)"
                >
                  <el-input
                    v-model="phone.imei"
                    :placeholder="phone.isNoIMEIMode ? '已启用无IMEI模式，允许字母+数字' : '请输入15位IMEI号（双击启用无IMEI模式）'"
                    :maxlength="phone.isNoIMEIMode ? 30 : 15"
                    clearable
                    @input="formatImei(phone)"
                    @blur="validateImeiOnBlur(phone)"
                  >
                    <template #suffix>
                      <span
                        v-if="phone.isNoIMEIMode"
                        class="text-xs text-success"
                      >
                        <i class="fas fa-check-circle" /> 无IMEI
                      </span>
                      <el-button
                        v-else-if="isMobile"
                        link
                        type="primary"
                        title="扫码识别IMEI"
                        @click.stop="scanImei(phone)"
                      >
                        <i class="fas fa-qrcode" />
                      </el-button>
                    </template>
                  </el-input>
                </div>
                <div
                  v-if="phone.imeiValid === false"
                  class="error-message"
                >
                  {{ phone.isNoIMEIMode ? 'IMEI必须与序列号相同' : 'IMEI号必须是15位纯数字' }}
                </div>
                <div
                  v-if="phone.isNoIMEIMode"
                  class="text-xs text-gray-500 mt-1"
                >
                  双击IMEI输入框可切换回标准模式
                </div>
              </el-form-item>
            </div>

            <div class="grid-row">
              <el-form-item
                label="入库价格"
                :prop="`phones.${index}.purchase_cost`"
              >
                <el-input
                  :model-value="formatPriceValue(phone.purchase_cost)"
                  placeholder="请输入入库价格"
                  clearable
                  inputmode="decimal"
                  @input="updatePurchasePrice(phone, $event)"
                />
              </el-form-item>
            </div>

            <div
              v-if="formData.product_status === '二手'"
              class="grid-row"
            >
              <el-form-item label="H5上架">
                <el-switch
                  v-model="phone.is_published"
                  :active-value="1"
                  :inactive-value="0"
                  active-text="上架中"
                  inactive-text="已下架"
                  inline-prompt
                />
                <div class="field-hint">
                  关闭后H5商城将不显示此商品
                </div>
              </el-form-item>
            </div>
          </div>
        </div>
      </div>

      <DataEmptyState
        v-if="formData.phones.length === 0"
        size="compact"
        description="暂无商品"
      >
        <el-button
          type="primary"
          @click="emit('add')"
        >
          添加第一个商品
        </el-button>
      </DataEmptyState>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Brand, Color, MemoryOption as Memory, Model } from '@/types'
import type { StockInFormModel, StockInPhoneItem } from './types'

interface Props {
  isMobile: boolean
  cacheVersion: number
  formData: StockInFormModel
  hasRowError: (_phone: StockInPhoneItem) => boolean
  getFilteredBrandsForPhone: (_index: number) => Brand[]
  getFilteredModelsForPhone: (_index: number) => Model[]
  getFilteredColorsForPhone: (_index: number) => Color[]
  getFilteredMemoriesForPhone: (_index: number) => Memory[]
  handleBrandFilter: (_query: string, _index: number) => boolean
  handleModelFilter: (_query: string, _index: number) => boolean
  handleColorFilter: (_query: string, _index: number) => boolean
  handleMemoryFilter: (_query: string, _index: number) => boolean
  handleBrandChange: (_phone: StockInPhoneItem) => void | Promise<void>
  formatSerialNumber: (_phone: StockInPhoneItem) => void
  formatImei: (_phone: StockInPhoneItem) => void
  formatPriceValue: (_value: number | string | undefined) => string
  updatePurchasePrice: (_phone: StockInPhoneItem, _value: string) => void
  removePhone: (_index: number) => void
  validateSerialOnBlur: (_phone: StockInPhoneItem) => void
  validateImeiOnBlur: (_phone: StockInPhoneItem) => void
  scanSerialNumber: (_phone: StockInPhoneItem) => void
  scanImei: (_phone: StockInPhoneItem) => void
  enableNoImeiMode: (_phone: StockInPhoneItem) => void
}

const emit = defineEmits<{
  add: []
  batch: []
  clear: []
}>()

const props = defineProps<Props>()

const getRowClassName = ({ row }: { row: StockInPhoneItem }) => (
  props.hasRowError(row) ? 'row-error' : ''
)

let lastImeiTouchPhone: StockInPhoneItem | null = null
let lastImeiTouchAt = 0
let suppressNativeImeiDoubleClickUntil = 0

// 移动端不可靠地产生 dblclick，用同一 IMEI 输入区域的两次触摸模拟双击。
const handleImeiTouchEnd = (phone: StockInPhoneItem, event: TouchEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, .el-button, .el-input__clear, .el-input__suffix')) {
    lastImeiTouchPhone = null
    lastImeiTouchAt = 0
    return
  }

  const now = Date.now()
  if (lastImeiTouchPhone === phone && now - lastImeiTouchAt <= 400) {
    lastImeiTouchPhone = null
    lastImeiTouchAt = 0
    suppressNativeImeiDoubleClickUntil = now + 500
    props.enableNoImeiMode(phone)
    return
  }

  lastImeiTouchPhone = phone
  lastImeiTouchAt = now
}

const handleImeiDoubleClick = (phone: StockInPhoneItem) => {
  if (Date.now() < suppressNativeImeiDoubleClickUntil) return
  props.enableNoImeiMode(phone)
}
</script>

<style lang="scss" scoped>
.phone-list-header {
  justify-content: space-between;
}

.phone-list-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.phone-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 11px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  box-sizing: border-box;
}

.phone-list-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
}

.phone-list-actions :deep(.el-button) {
  margin-left: 0;
}

.modern-phone-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modern-phone-item {
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.modern-phone-item:hover {
  border-color: var(--admin-interactive-hover-border, var(--el-color-primary-light-5));
  box-shadow: var(--admin-interactive-hover-shadow, 0 2px 8px rgba(15, 23, 42, 0.08));
}

.phone-header {
  min-height: 38px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  box-sizing: border-box;
}

.phone-number {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.phone-grid {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.grid-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.grid-row.single-column {
  grid-template-columns: 1fr;
}

.long-input-field {
  width: 100%;
}

.long-input-field :deep(.el-input),
.long-input-field :deep(.el-input__wrapper) {
  width: 100%;
}

.imei-field {
  cursor: pointer;
}

.error-message {
  font-size: 12px;
  color: var(--el-color-danger);
  margin-top: 4px;
  line-height: 1.4;
}

.empty-state {
  padding: 36px 20px;
  text-align: center;
}

.empty-content {
  color: var(--el-text-color-secondary);
}

.empty-content i {
  margin-bottom: 12px;
  color: var(--el-text-color-placeholder);
  font-size: 38px;
}

.empty-content p {
  margin: 0 0 16px;
  font-size: 14px;
}

.batch-table-container {
  overflow: hidden;
  border-radius: 6px;
}

.stock-in-data-table :deep(.el-select),
.stock-in-data-table :deep(.el-input),
.stock-in-data-table :deep(.el-input-number) {
  width: 100%;
}

.stock-in-data-table .required {
  color: var(--tf-color-red-500);
  margin-left: 2px;
}

.stock-in-data-table :deep(.el-table__body tr.row-error > td.el-table__cell) {
  background: var(--el-color-danger-light-9) !important;
}

@media (max-width: 767px) {
  .phone-list-header {
    align-items: center;
    flex-wrap: wrap;
  }

  .phone-list-title {
    flex: 1 1 auto;
  }

  .phone-list-actions {
    width: 100%;
    margin-left: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .phone-list-actions :deep(.el-button) {
    min-width: 0;
    padding-inline: 8px;
  }

  .phone-list-body {
    background: var(--el-fill-color-extra-light);
  }

  .modern-phone-item:hover {
    box-shadow: none;
  }
}

@media (max-width: 480px) {
  .phone-list-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .phone-list-actions :deep(.el-button:nth-child(3)) {
    grid-column: span 2;
  }
}
</style>
