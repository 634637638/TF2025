<template>
  <section class="info-card stock-in-phone-list">
    <div class="card-header">
      <div class="card-icon">
        <i class="fas fa-mobile-alt"></i>
      </div>
      <h3 class="card-title">商品列表</h3>
      <div class="card-actions">
        <el-button type="primary" size="small" @click="emit('add')">
          <i class="fas fa-plus"></i>
          添加单条
        </el-button>
        <el-button type="success" size="small" @click="emit('batch')">
          <i class="fas fa-layer-group"></i>
          批量添加
        </el-button>
        <el-button
          v-if="formData.phones.length > 1"
          type="danger"
          size="small"
          @click="emit('clear')"
        >
          <i class="fas fa-trash-alt"></i>
          清空
        </el-button>
      </div>
    </div>

    <div class="card-content">
      <div v-if="!isMobile" class="batch-table-container">
        <div class="batch-toolbar">
          <div class="batch-info">
            <span class="batch-count">共 {{ formData.phones.length }} 条商品</span>
          </div>
        </div>

        <div class="batch-table-wrapper">
          <table class="batch-table">
            <thead>
              <tr>
                <th class="col-index">#</th>
                <th class="col-brand">品牌 <span class="required">*</span></th>
                <th class="col-model">型号 <span class="required">*</span></th>
                <th class="col-color">颜色 <span class="required">*</span></th>
                <th class="col-memory">内存 <span class="required">*</span></th>
                <th class="col-serial">序列号 <span class="required">*</span></th>
                <th class="col-imei">IMEI <span class="required">*</span></th>
                <th class="col-price">入库价格 <span class="required">*</span></th>
                <th class="col-action">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(phone, index) in formData.phones"
                :key="index"
                :class="{ 'row-error': hasRowError(phone) }"
              >
                <td class="col-index">{{ index + 1 }}</td>
                <td class="col-brand">
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
                </td>
                <td class="col-model">
                  <el-select
                    v-model="phone.model"
                    placeholder="选择型号"
                    filterable
                    :filter-method="(query) => handleModelFilter(query, index)"
                    clearable
                    :disabled="!phone.brand"
                    size="small"
                    popper-class="model-select-dropdown"
                  >
                    <el-option
                      v-for="model in getFilteredModelsForPhone(index)"
                      :key="`${model.id}-${cacheVersion}`"
                      :label="model.name"
                      :value="model.id"
                    />
                  </el-select>
                </td>
                <td class="col-color">
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
                </td>
                <td class="col-memory">
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
                      :label="memory.name || memory.capacity"
                      :value="memory.id"
                    />
                  </el-select>
                </td>
                <td class="col-serial">
                  <el-input
                    v-model="phone.serial_number"
                    placeholder="序列号"
                    maxlength="20"
                    size="small"
                    @input="formatSerialNumber(phone)"
                  />
                </td>
                <td class="col-imei">
                  <div class="cursor-pointer" @dblclick="enableNoIMEIMode(phone)">
                    <el-input
                      v-model="phone.imei"
                      :placeholder="phone.isNoIMEIMode ? '无IMEI' : 'IMEI'"
                      :maxlength="phone.isNoIMEIMode ? 30 : 15"
                      size="small"
                      @input="formatIMEI(phone)"
                    />
                  </div>
                </td>
                <td class="col-price">
                  <el-input
                    :model-value="formatPriceValue(phone.purchase_price)"
                    placeholder="价格"
                    clearable
                    inputmode="decimal"
                    size="small"
                    @input="updatePurchasePrice(phone, $event)"
                  />
                </td>
                <td class="col-action">
                  <el-button
                    v-if="formData.phones.length > 1"
                    type="danger"
                    size="small"
                    class="delete-row-btn"
                    @click="removePhone(index)"
                  >
                    <span class="delete-icon">−</span>
                  </el-button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else class="modern-phone-list">
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
              @click="removePhone(index)"
            >
              <i class="fas fa-times"></i>
            </el-button>
          </div>

          <div class="phone-grid">
            <div class="grid-row">
              <el-form-item label="品牌" :prop="`phones.${index}.brand`">
                <el-select
                  v-model="phone.brand"
                  placeholder="请选择或输入品牌"
                  filterable
                  :filter-method="(query) => handleBrandFilter(query, index)"
                  clearable
                  teleported
                  popper-class="stock-in-mobile-popper"
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

              <el-form-item label="型号" :prop="`phones.${index}.model`">
                <el-select
                  v-model="phone.model"
                  placeholder="请选择或输入型号"
                  :disabled="!phone.brand"
                  clearable
                  filterable
                  :filter-method="(query) => handleModelFilter(query, index)"
                  teleported
                  popper-class="stock-in-mobile-popper model-select-dropdown"
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
              <el-form-item label="颜色" :prop="`phones.${index}.color`">
                <el-select
                  v-model="phone.color"
                  placeholder="请选择或输入颜色"
                  clearable
                  filterable
                  :filter-method="(query) => handleColorFilter(query, index)"
                  teleported
                  popper-class="stock-in-mobile-popper"
                >
                  <el-option
                    v-for="color in getFilteredColorsForPhone(index)"
                    :key="color.id"
                    :label="color.name"
                    :value="color.id"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="内存" :prop="`phones.${index}.memory`">
                <el-select
                  v-model="phone.memory"
                  placeholder="请选择或输入内存"
                  clearable
                  filterable
                  :filter-method="(query) => handleMemoryFilter(query, index)"
                  teleported
                  popper-class="stock-in-mobile-popper"
                >
                  <el-option
                    v-for="memory in getFilteredMemoriesForPhone(index)"
                    :key="memory.id"
                    :label="memory.name || memory.capacity"
                    :value="memory.id"
                  />
                </el-select>
              </el-form-item>
            </div>

            <div class="grid-row single-column">
              <el-form-item label="序列号" :prop="`phones.${index}.serial_number`">
                <div class="long-input-field">
                  <el-input
                    v-model="phone.serial_number"
                    placeholder="请输入序列号"
                    clearable
                    @input="formatSerialNumber(phone)"
                    @blur="validateSerialOnBlur(phone)"
                  >
                    <template v-if="isMobile" #suffix>
                      <el-button
                        link
                        type="primary"
                        title="扫码识别序列号"
                        @click="scanSerialNumber(phone)"
                      >
                        <i class="fas fa-qrcode"></i>
                      </el-button>
                    </template>
                  </el-input>
                </div>
                <div v-if="phone.serialValid === false" class="error-message">
                  序列号必须包含字母（4-20位字符）
                </div>
              </el-form-item>
            </div>

            <div class="grid-row single-column">
              <el-form-item label="IMEI号" :prop="`phones.${index}.imei`">
                <div class="long-input-field imei-field" @dblclick="enableNoIMEIMode(phone)">
                  <el-input
                    v-model="phone.imei"
                    :placeholder="phone.isNoIMEIMode ? '已启用无IMEI模式，允许字母+数字' : '请输入15位IMEI号（双击启用无IMEI模式）'"
                    :maxlength="phone.isNoIMEIMode ? 30 : 15"
                    clearable
                    @input="formatIMEI(phone)"
                    @blur="validateIMEIOnBlur(phone)"
                  >
                    <template #suffix>
                      <span v-if="phone.isNoIMEIMode" class="text-xs text-success">
                        <i class="fas fa-check-circle"></i> 无IMEI
                      </span>
                      <el-button
                        v-else-if="isMobile"
                        link
                        type="primary"
                        title="扫码识别IMEI"
                        @click.stop="scanIMEI(phone)"
                      >
                        <i class="fas fa-qrcode"></i>
                      </el-button>
                    </template>
                  </el-input>
                </div>
                <div v-if="phone.imeiValid === false" class="error-message">
                  {{ phone.isNoIMEIMode ? 'IMEI必须与序列号相同' : 'IMEI号必须是15位纯数字' }}
                </div>
                <div v-if="phone.isNoIMEIMode" class="text-xs text-gray-500 mt-1">
                  双击IMEI输入框可切换回标准模式
                </div>
              </el-form-item>
            </div>

            <div class="grid-row">
              <el-form-item label="入库价格" :prop="`phones.${index}.purchase_price`">
                <el-input
                  :model-value="formatPriceValue(phone.purchase_price)"
                  placeholder="请输入入库价格"
                  clearable
                  inputmode="decimal"
                  @input="updatePurchasePrice(phone, $event)"
                />
              </el-form-item>
            </div>

            <div v-if="formData.product_status === '二手'" class="grid-row">
              <el-form-item label="H5上架">
                <el-switch
                  v-model="phone.is_published"
                  :active-value="1"
                  :inactive-value="0"
                  active-text="上架中"
                  inactive-text="已下架"
                  inline-prompt
                />
                <div class="field-hint">关闭后H5商城将不显示此商品</div>
              </el-form-item>
            </div>
          </div>
        </div>
      </div>

      <div v-if="formData.phones.length === 0" class="empty-state">
        <div class="empty-content">
          <i class="fas fa-box-open"></i>
          <p>暂无商品</p>
          <el-button type="primary" @click="emit('add')">添加第一个商品</el-button>
        </div>
      </div>
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
  hasRowError: (phone: StockInPhoneItem) => boolean
  getFilteredBrandsForPhone: (index: number) => Brand[]
  getFilteredModelsForPhone: (index: number) => Model[]
  getFilteredColorsForPhone: (index: number) => Color[]
  getFilteredMemoriesForPhone: (index: number) => Memory[]
  handleBrandFilter: (query: string, index: number) => boolean
  handleModelFilter: (query: string, index: number) => boolean
  handleColorFilter: (query: string, index: number) => boolean
  handleMemoryFilter: (query: string, index: number) => boolean
  handleBrandChange: (phone: StockInPhoneItem) => void | Promise<void>
  formatSerialNumber: (phone: StockInPhoneItem) => void
  formatIMEI: (phone: StockInPhoneItem) => void
  formatPriceValue: (value: number | string | undefined) => string
  updatePurchasePrice: (phone: StockInPhoneItem, value: string) => void
  removePhone: (index: number) => void
  validateSerialOnBlur: (phone: StockInPhoneItem) => void
  validateIMEIOnBlur: (phone: StockInPhoneItem) => void
  scanSerialNumber: (phone: StockInPhoneItem) => void
  scanIMEI: (phone: StockInPhoneItem) => void
  enableNoIMEIMode: (phone: StockInPhoneItem) => void
}

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'batch'): void
  (e: 'clear'): void
}>()

defineProps<Props>()
</script>

<style lang="scss" scoped>
.info-card {
  background: #f8fafc;
  border-radius: 18px;
  overflow: hidden;
  margin-bottom: 24px;
  border: none;
  box-shadow: inset 0 0 0 1px rgba(203, 213, 225, 0.72);
  transition: all 0.24s ease;
}

.info-card:hover {
  box-shadow:
    inset 0 0 0 1px rgba(191, 219, 254, 0.9),
    0 10px 24px rgba(99, 102, 241, 0.08);
}

.card-header {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.96) 0%, rgba(241, 245, 249, 0.96) 100%);
  padding: 18px 22px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(203, 213, 225, 0.72);
}

.card-icon {
  width: 46px;
  height: 46px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex: 0 0 auto;
}

.card-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #334155;
}

.card-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.card-content {
  padding: 22px;
}

.modern-phone-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modern-phone-item {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.modern-phone-item:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.phone-header {
  background: #f8fafc;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
}

.phone-number {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.phone-grid {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.grid-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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
  color: #ef4444;
  margin-top: 4px;
  line-height: 1.4;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
}

.empty-content {
  color: #6b7280;
}

.empty-content i {
  font-size: 48px;
  color: #d1d5db;
  margin-bottom: 16px;
}

.empty-content p {
  margin: 0 0 20px;
  font-size: 16px;
}

.batch-table-container {
  background: #ffffff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.9);
}

.batch-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: #ffffff;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
}

.batch-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.batch-count {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
}

.batch-table-wrapper {
  width: 100%;
  overflow-x: auto;
  overflow-y: auto;
  max-height: 60vh;
  padding-bottom: 6px;
  scrollbar-gutter: stable;
}

.batch-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  background: white;
  font-size: 14px;
}

.batch-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #f8f9fa;
}

.batch-table thead th {
  white-space: nowrap;
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
  background: #f8f9fa;
}

.batch-table tbody tr {
  border-bottom: 1px solid #e9ecef;
  transition: background-color 0.2s;
}

.batch-table tbody tr:hover {
  background: #f8f9fa;
}

.batch-table tbody tr.row-error {
  background: #fff5f5;
}

.batch-table tbody td {
  padding: 10px 8px;
  vertical-align: middle;
  overflow: hidden;
}

.batch-table .col-index {
  width: 4%;
  text-align: center;
  font-weight: 600;
  font-size: 15px;
  color: #6c757d;
}

.batch-table .col-brand {
  width: 11%;
}

.batch-table .col-model {
  width: 16%;
}

.batch-table .col-color,
.batch-table .col-memory {
  width: 10%;
}

.batch-table .col-serial {
  width: 15%;
}

.batch-table .col-imei {
  width: 16%;
}

.batch-table .col-price {
  width: 12%;
}

.batch-table .col-action {
  width: 6%;
  min-width: 68px;
  text-align: center;
}

.batch-table :deep(.el-select),
.batch-table :deep(.el-input),
.batch-table :deep(.el-input-number) {
  width: 100%;
}

.batch-table .col-brand :deep(.el-select),
.batch-table .col-brand :deep(.el-input) {
  min-width: 110px;
}

.batch-table .col-model :deep(.el-select),
.batch-table .col-model :deep(.el-input) {
  min-width: 150px;
}

.batch-table .col-color :deep(.el-select),
.batch-table .col-color :deep(.el-input),
.batch-table .col-memory :deep(.el-select),
.batch-table .col-memory :deep(.el-input) {
  min-width: 100px;
}

.batch-table .col-serial :deep(.el-input),
.batch-table .col-imei :deep(.el-input) {
  min-width: 140px;
}

.batch-table :deep(.el-input__wrapper),
.batch-table :deep(.el-select__wrapper),
.batch-table :deep(.el-textarea__inner) {
  font-size: 14px;
}

.batch-table thead th .required {
  color: #ef4444;
  margin-left: 2px;
}

@media (max-width: 767px) {
  .info-card {
    margin-bottom: 12px;
    border-radius: 14px;
  }

  .card-header {
    padding: 14px 14px 12px;
    gap: 10px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .card-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    font-size: 15px;
  }

  .card-title {
    font-size: 15px;
  }

  .card-actions {
    width: 100%;
    margin-left: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .card-actions :deep(.el-button) {
    width: 100%;
    min-width: 0;
    padding-left: 8px;
    padding-right: 8px;
  }

  .card-content {
    padding: 12px 10px 10px;
  }

  .modern-phone-list {
    gap: 12px;
  }

  .modern-phone-item {
    border-radius: 14px;
  }

  .phone-header {
    padding: 10px 12px;
  }

  .phone-grid {
    padding: 12px 10px 10px;
    gap: 10px;
  }

  .grid-row {
    gap: 10px;
  }

  .batch-table-container {
    border-radius: 0;
  }

  .batch-toolbar {
    padding: 10px 12px;
  }

  .batch-table-wrapper {
    max-height: 50vh;
  }

  .batch-table {
    font-size: 12px;
  }

  .batch-table thead th {
    padding: 8px 4px;
    font-size: 11px;
  }

  .batch-table tbody td {
    padding: 6px 4px;
  }

  .batch-table :deep(.el-select),
  .batch-table :deep(.el-input),
  .batch-table :deep(.el-input-number) {
    min-width: 80px;
  }

  .batch-table .col-brand,
  .batch-table .col-model,
  .batch-table .col-color,
  .batch-table .col-memory {
    min-width: 80px;
  }

  .batch-table .col-serial,
  .batch-table .col-imei {
    min-width: 100px;
  }

  .batch-table .col-price {
    min-width: 90px;
  }
}

@media (max-width: 480px) {
  .card-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .card-actions :deep(.el-button:nth-child(3)) {
    grid-column: span 2;
  }
}
</style>
