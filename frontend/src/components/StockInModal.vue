<!--
  StockInModal - 现代化库存入库模态框组件

  功能描述：
  - 提供手机端友好的库存入库功能
  - 支持扫码识别IMEI和序列号
  - 智能识别苹果和国产品牌的不同格式
  - 实时表单验证和数据联动
  - 现代化UI设计，支持移动端优化

  权限要求：
  - stock-in:view (查看权限)
  - stock-in:create (创建权限)

  API接口：
  - GET /suppliers - 获取供应商列表
  - GET /stores - 获取店铺列表
  - GET /brands - 获取品牌列表
  - GET /models - 获取型号列表
  - POST /stock-in - 提交入库数据
-->
<template>
  <!-- 统一入库弹窗 -->
  <MobileDialog
    v-model="dialogVisible"
    :title="dialogTitle"
    :width="isMobile ? '95%' : '1240px'"
    :force-fullscreen="isMobile"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    dialog-class="stock-in-dialog"
    :show-default-footer="false"
    destroy-on-close
    @close="handleDialogClose"
  >
    <template v-if="isMobile" #header>
      <div class="stock-in-dialog__header">
        <span class="stock-in-dialog__title">{{ dialogTitle }}</span>
      </div>
    </template>

    <div class="dialog-body">
            <el-form
              ref="formRef"
              :model="stockInForm"
              :rules="formRules"
              label-position="top"
              class="modern-form"
            >
              <!-- 入库信息卡片 -->
              <div class="info-card">
                <div class="card-header">
                  <div class="card-icon">
                    <i class="fas fa-info-circle"></i>
                  </div>
                  <h3 class="card-title">入库信息</h3>
                </div>
                <div class="card-content">
                  <!-- PC端一行展示 -->
                  <div class="form-row-group four-columns" v-if="!isMobile">
                    <el-form-item label="供应商" prop="supplier_id">
                      <el-select
                        v-model="stockInForm.supplier_id"
                        placeholder="请选择供应商"
                        filterable
                        :filter-method="handleSupplierFilter"
                        clearable
                        teleported
                        popper-class="stock-in-mobile-popper"
                      >
                        <el-option
                          v-for="supplier in getFilteredSuppliers()"
                          :key="`${supplier.id}-${supplierSearchQuery || ''}`"
                          :label="supplier.name"
                          :value="supplier.id"
                        />
                      </el-select>
                    </el-form-item>

                    <el-form-item label="入库店铺" prop="store_id">
                      <el-select
                        v-model="stockInForm.store_id"
                        placeholder="请选择店铺"
                        filterable
                        :filter-method="handleStoreFilter"
                        clearable
                        teleported
                        popper-class="stock-in-mobile-popper"
                      >
                        <el-option
                          v-for="store in getFilteredStores()"
                          :key="`${store.id}-${storeSearchQuery || ''}`"
                          :label="store.name"
                          :value="store.id"
                        />
                      </el-select>
                    </el-form-item>

                    <el-form-item label="入库日期" prop="stock_in_date">
                      <el-date-picker
                        v-model="stockInForm.stock_in_date"
                        type="date"
                        placeholder="请选择入库日期"
                        format="YYYY-MM-DD"
                        value-format="YYYY-MM-DD"
                        teleported
                        popper-class="stock-in-mobile-popper"
                      />
                    </el-form-item>

                    <el-form-item label="商品状态" prop="product_status">
                      <el-select
                        v-model="stockInForm.product_status"
                        placeholder="请选择商品状态"
                        teleported
                        popper-class="stock-in-mobile-popper"
                      >
                        <el-option label="全新" value="全新" />
                        <el-option label="二手" value="二手" />
                      </el-select>
                    </el-form-item>
                  </div>

                  <!-- 移动端两行展示 -->
                  <template v-else>
                    <!-- 第一行：供应商和店铺 -->
                    <div class="form-row-group">
                      <el-form-item label="供应商" prop="supplier_id">
                        <el-select
                          v-model="stockInForm.supplier_id"
                          placeholder="请选择供应商"
                          filterable
                          :filter-method="handleSupplierFilter"
                          clearable
                          teleported
                          popper-class="stock-in-mobile-popper"
                        >
                          <el-option
                            v-for="supplier in getFilteredSuppliers()"
                            :key="`${supplier.id}-${supplierSearchQuery || ''}`"
                            :label="supplier.name"
                            :value="supplier.id"
                          />
                        </el-select>
                      </el-form-item>

                      <el-form-item label="入库店铺" prop="store_id">
                        <el-select
                          v-model="stockInForm.store_id"
                          placeholder="请选择店铺"
                          filterable
                          :filter-method="handleStoreFilter"
                          clearable
                          teleported
                          popper-class="stock-in-mobile-popper"
                        >
                          <el-option
                            v-for="store in getFilteredStores()"
                            :key="`${store.id}-${storeSearchQuery || ''}`"
                            :label="store.name"
                            :value="store.id"
                          />
                        </el-select>
                      </el-form-item>
                    </div>

                    <!-- 第二行：入库日期、商品状态 -->
                    <div class="form-row-group">
                      <el-form-item label="入库日期" prop="stock_in_date">
                        <el-date-picker
                          v-model="stockInForm.stock_in_date"
                          type="date"
                          placeholder="请选择入库日期"
                          format="YYYY-MM-DD"
                          value-format="YYYY-MM-DD"
                          teleported
                          popper-class="stock-in-mobile-popper"
                        />
                      </el-form-item>

                      <el-form-item label="商品状态" prop="product_status">
                        <el-select
                          v-model="stockInForm.product_status"
                          placeholder="请选择商品状态"
                          teleported
                          popper-class="stock-in-mobile-popper"
                        >
                          <el-option label="全新" value="全新" />
                          <el-option label="二手" value="二手" />
                        </el-select>
                      </el-form-item>
                    </div>
                  </template>
                </div>
              </div>

              <!-- 商品列表卡片 -->
              <div class="info-card">
                <div class="card-header">
                  <div class="card-icon">
                    <i class="fas fa-mobile-alt"></i>
                  </div>
                  <h3 class="card-title">商品列表</h3>
                  <div class="card-actions">
                    <el-button type="primary" size="small" @click="addPhone">
                      <i class="fas fa-plus"></i>
                      添加单条
                    </el-button>
                    <el-button type="success" size="small" @click="showBatchCountDialog = true">
                      <i class="fas fa-layer-group"></i>
                      批量添加
                    </el-button>
                    <el-button v-if="stockInForm.phones.length > 1" type="danger" size="small" @click="clearAllPhones">
                      <i class="fas fa-trash-alt"></i>
                      清空
                    </el-button>
                  </div>
                </div>
                <div class="card-content">
                  <!-- PC端表格视图 -->
                  <div class="batch-table-container" v-if="!isMobile">
                    <div class="batch-toolbar">
                      <div class="batch-info">
                        <span class="batch-count">共 {{ stockInForm.phones.length }} 条商品</span>
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
                          <tr v-for="(phone, index) in stockInForm.phones" :key="index" :class="{ 'row-error': hasRowError(phone) }">
                            <td class="col-index">{{ index + 1 }}</td>
                            <td class="col-brand">
                              <el-select
                                v-model="phone.brand"
                                placeholder="选择品牌"
                                filterable
                                :filter-method="(query) => handleBrandFilter(query, index)"
                                clearable
                                @change="handleBrandChange(phone)"
                                size="small"
                              >
                                <el-option v-for="brand in getFilteredBrandsForPhone(index)" :key="`${brand.id}-${brandSearchQueries.get(index) || ''}`" :label="brand.name" :value="brand.id" />
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
                                <el-option v-for="model in getFilteredModelsForPhone(index)" :key="`${model.id}-${cacheVersion}-${modelSearchQueries.get(index) || ''}`" :label="model.name" :value="model.id" />
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
                                <el-option v-for="color in getFilteredColorsForPhone(index)" :key="`${color.id}-${colorSearchQueries.get(index) || ''}`" :label="color.name" :value="color.id" />
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
                                <el-option v-for="memory in getFilteredMemoriesForPhone(index)" :key="`${memory.id}-${memorySearchQueries.get(index) || ''}`" :label="memory.name || memory.capacity" :value="memory.id" />
                              </el-select>
                            </td>
                            <td class="col-serial">
                              <el-input
                                v-model="phone.serial_number"
                                placeholder="序列号"
                                maxlength="20"
                                @input="formatSerialNumber(phone)"
                                size="small"
                              />
                            </td>
                            <td class="col-imei">
                              <div @dblclick="enableNoIMEIMode(phone)" class="cursor-pointer">
                                <el-input
                                  v-model="phone.imei"
                                  :placeholder="phone.isNoIMEIMode ? '无IMEI' : 'IMEI'"
                                  :maxlength="phone.isNoIMEIMode ? 30 : 15"
                                  @input="formatIMEI(phone)"
                                  size="small"
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
                                v-if="stockInForm.phones.length > 1"
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

                  <!-- 移动端卡片视图 -->
                  <div class="modern-phone-list" v-else>
                    <div v-for="(phone, index) in stockInForm.phones" :key="index" class="modern-phone-item">
                      <!-- 商品头部 -->
                      <div class="phone-header">
                        <span class="phone-number">商品 #{{ index + 1 }}</span>
                        <el-button
                          v-if="stockInForm.phones.length > 1"
                          type="danger"
                          size="small"
                          circle
                          @click="removePhone(index)"
                        >
                          <i class="fas fa-times"></i>
                        </el-button>
                      </div>

                      <!-- 商品信息 -->
                      <div class="phone-grid">
                        <!-- 品牌和型号 -->
                        <div class="grid-row">
                          <el-form-item label="品牌" :prop="`phones.${index}.brand`">
                            <el-select
                              v-model="phone.brand"
                              placeholder="请选择或输入品牌"
                              filterable
                              :filter-method="(query) => handleBrandFilter(query, index)"
                              clearable
                              @change="handleBrandChange(phone)"
                              teleported
                              popper-class="stock-in-mobile-popper"
                            >
                              <el-option
                                v-for="brand in getFilteredBrandsForPhone(index)"
                                :key="`${brand.id}-${brandSearchQueries.get(index) || ''}`"
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
                                :key="`${model.id}-${cacheVersion}-${modelSearchQueries.get(index) || ''}`"
                                :label="model.name"
                                :value="model.id"
                              />
                            </el-select>
                          </el-form-item>
                        </div>

                        <!-- 颜色和内存 -->
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
                                :key="`${color.id}-${colorSearchQueries.get(index) || ''}`"
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
                                :key="`${memory.id}-${memorySearchQueries.get(index) || ''}`"
                                :label="memory.name || memory.capacity"
                                :value="memory.id"
                              />
                            </el-select>
                          </el-form-item>
                        </div>

                        <!-- 序列号单独一行 -->
                        <div class="grid-row single-column">
                          <el-form-item label="序列号" :prop="`phones.${index}.serial_number`">
                            <div class="long-input-field">
                              <el-input
                                v-model="phone.serial_number"
                                placeholder="请输入序列号"
                                @input="formatSerialNumber(phone)"
                                @blur="validateSerialOnBlur(phone)"
                                clearable
                              >
                                <template #suffix v-if="isMobile">
                                  <el-button
                                    link
                                    type="primary"
                                    @click="scanSerialNumber(phone)"
                                    title="扫码识别序列号"
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

                        <!-- IMEI单独一行 -->
                        <div class="grid-row single-column">
                          <el-form-item label="IMEI号" :prop="`phones.${index}.imei`">
                            <div class="long-input-field imei-field" @dblclick="enableNoIMEIMode(phone)">
                              <el-input
                                v-model="phone.imei"
                                :placeholder="phone.isNoIMEIMode ? '已启用无IMEI模式，允许字母+数字' : '请输入15位IMEI号（双击启用无IMEI模式）'"
                                :maxlength="phone.isNoIMEIMode ? 30 : 15"
                                @input="formatIMEI(phone)"
                                @blur="validateIMEIOnBlur(phone)"
                                clearable
                              >
                                <template #suffix>
                                  <span v-if="phone.isNoIMEIMode" class="text-xs text-success">
                                    <i class="fas fa-check-circle"></i> 无IMEI
                                  </span>
                                  <el-button
                                    v-else-if="isMobile"
                                    link
                                    type="primary"
                                    @click.stop="scanIMEI(phone)"
                                    title="扫码识别IMEI"
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

                        <!-- 入库价格 -->
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

                        <!-- 上架开关（仅二手商品显示） -->
                        <div v-if="stockInForm.product_status === '二手'" class="grid-row">
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

                  <!-- 空状态 -->
                  <div v-if="stockInForm.phones.length === 0" class="empty-state">
                    <div class="empty-content">
                      <i class="fas fa-box-open"></i>
                      <p>暂无商品</p>
                      <el-button type="primary" @click="addPhone">添加第一个商品</el-button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 备注信息卡片 -->
              <div class="info-card">
                <div class="card-header">
                  <div class="card-icon">
                    <i class="fas fa-comment"></i>
                  </div>
                  <h3 class="card-title">备注信息</h3>
                </div>
                <div class="card-content">
                  <el-form-item label="备注" prop="remarks">
                    <el-input
                      v-model="stockInForm.remarks"
                      type="textarea"
                      :rows="2"
                      placeholder="请输入备注信息"
                      resize="none"
                    />
                  </el-form-item>
                </div>
              </div>
            </el-form>
          </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="operator-info">
          <span>入库员：<strong>{{ stockInForm.operator_name }}</strong></span>
        </div>
        <div class="footer-actions">
          <el-button type="default" @click="handleDialogClose">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ mode === 'create' ? '提交入库' : '更新入库' }}
          </el-button>
        </div>
      </div>
    </template>
  </MobileDialog>

  <!-- 优化的扫码器组件 -->
  <teleport to="body">
    <OptimizedScanner
      v-model:visible="optimizedScannerVisible"
      :scan-type="currentScanType"
      :phone="currentScanningPhone"
      :showROIDisplay="true"
      :enableAndroidOptimization="true"
      :showPerformance="isDevMode"
      @success="handleScanSuccess"
      @manual="handleScanManual"
      @cancel="handleScanCancel"
    />
  </teleport>

  <!-- 批量添加对话框 -->
  <MobileDialog
    v-model="showBatchCountDialog"
    title="批量添加商品"
    width="400px"
    :close-on-click-modal="false"
    dialog-class="stock-in-batch-dialog"
    :show-default-footer="false"
  >
    <el-form @submit.prevent="confirmBatchAdd">
      <el-form-item label="添加数量">
        <el-input-number
          v-model="batchCount"
          :min="1"
          :max="100"
          placeholder="请输入要添加的商品数量"
          style="width: 100%"
        />
        <div style="margin-top: 8px; color: #909399; font-size: 12px;">
          最多可一次添加 100 条商品
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="default" @click="showBatchCountDialog = false">取消</el-button>
      <el-button type="primary" @click="confirmBatchAdd">确定添加</el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import { useAuthStore } from '@/stores/auth'
import OptimizedScanner from './OptimizedScanner.vue'
import { useMobile } from '@/composables/useMobile'
import type { Supplier, Store } from '@/types/system'
import type { Phone, Brand, Model, Color, MemoryOption as Memory } from '@/types'
import type { ModalProps, UpdateVisibleEmits, SuccessEmits, CancelEmits } from '@/types/component'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'

// 手机入库项扩展 Phone 类型
interface PhoneItem extends Partial<Phone> {
  brand?: number | string
  model?: number | string
  color?: number | string
  memory?: number | string
  serial_number?: string
  imei?: string
  purchase_price?: number
  is_published?: number
  imeiValid?: boolean
  serialValid?: boolean
  isNoIMEIMode?: boolean
}

interface StockInForm {
  id?: string
  supplier_id: string
  store_id: string | number
  stock_in_date: string
  operator_name: string
  product_status: string
  remarks: string
  phones: PhoneItem[]
}

// ==================== Props & Emits ====================

interface Props extends ModalProps {
  mode?: 'create' | 'edit'
  editId?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  editId: ''
})

type Emits = UpdateVisibleEmits & SuccessEmits & CancelEmits

const emit = defineEmits<Emits>()

// ==================== Composables ====================

const { isMobile } = useMobile()
const authStore = useAuthStore()

// ==================== 响应式数据 ====================

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const dialogTitle = computed(() => {
  return props.mode === 'create' ? '新增入库' : '编辑入库'
})

const formRef = ref<FormInstance>()
const submitting = ref(false)

// 表单数据
const stockInForm = reactive<StockInForm>({
  supplier_id: '',
  store_id: '',
  stock_in_date: TimeUtil.nowFormatted(TIME_FORMATS.DATE),
  operator_name: authStore.user?.name || authStore.user?.username || '',
  product_status: '全新',
  remarks: '',
  phones: []
})

// 下拉数据
const suppliers = ref<Supplier[]>([])
const stores = ref<Store[]>([])
const brands = ref<Brand[]>([])
const models = ref<Model[]>([])
const colors = ref<Color[]>([])
const memories = ref<Memory[]>([])

// 品牌型号缓存 - 按品牌ID存储对应的型号列表
const brandModelsCache = ref<Map<number, Model[]>>(new Map())
// 缓存版本号 - 用于强制更新视图
const cacheVersion = ref(0)
// 搜索关键词 - 按手机索引存储搜索关键词
const modelSearchQueries = ref<Map<number, string>>(new Map())
const colorSearchQueries = ref<Map<number, string>>(new Map())
const memorySearchQueries = ref<Map<number, string>>(new Map())
const brandSearchQueries = ref<Map<number, string>>(new Map())
// 入库信息的搜索关键词
const supplierSearchQuery = ref('')
const storeSearchQuery = ref('')

// 扫码器
const optimizedScannerVisible = ref(false)
const currentScanType = ref<'imei' | 'serial'>('imei')
const currentScanningPhone = ref<PhoneItem | null>(null)

// 批量添加对话框
const showBatchCountDialog = ref(false)
const batchCount = ref(5)

// 开发模式
const isDevMode = import.meta.env.DEV

// ==================== 表单验证规则 ====================

const formRules = {
  supplier_id: [
    ValidationRules.required('请选择供应商')
  ],
  store_id: [
    ValidationRules.required('请选择入库店铺')
  ],
  stock_in_date: [
    ValidationRules.required('请选择入库日期')
  ],
  product_status: [
    ValidationRules.required('请选择商品状态')
  ]
}

// ==================== 方法 ====================

// 初始化数据
const initializeData = async () => {
  // 如果有编辑ID，加载编辑数据
  if (props.mode === 'edit' && props.editId) {
    await loadEditData()
  } else {
    // 新增模式，初始化默认值
    stockInForm.id = ''
    stockInForm.supplier_id = ''
    stockInForm.store_id = ''
    stockInForm.stock_in_date = TimeUtil.nowFormatted(TIME_FORMATS.DATE)
    stockInForm.operator_name = authStore.user?.name || authStore.user?.username || ''
    stockInForm.product_status = '全新'
    stockInForm.remarks = ''
    stockInForm.phones = []

    // 添加一个默认手机项
    addPhone()
  }
}

// 加载编辑数据
const loadEditData = async () => {
  try {
    const response = await unifiedApi.get(`/stock-in/${props.editId}`)
    if (response.success && response.data) {
      const data = response.data

      // 填充表单基本信息
      stockInForm.id = data.id
      stockInForm.supplier_id = data.supplier_id
      stockInForm.store_id = data.store_id
      stockInForm.stock_in_date = data.Inventorytime ? TimeUtil.format(data.Inventorytime, TIME_FORMATS.DATE) : TimeUtil.nowFormatted(TIME_FORMATS.DATE)
      stockInForm.operator_name = data.operator_name || authStore.user?.name || authStore.user?.username || ''
      stockInForm.product_status = data.phone_condition || '全新'
      stockInForm.remarks = data.note || ''

      // 清空现有商品列表
      stockInForm.phones = []

      // 添加商品（单条记录编辑）
      const phoneItem: PhoneItem = {
        brand: data.brand_id,
        model: data.model_id,
        color: data.color_id,
        memory: data.memory_id,
        serial_number: data.serial_number || '',
        imei: data.imei || '',
        purchase_price: data.unit_cost,
        imeiValid: undefined,
        serialValid: undefined,
        // 判断是否为无IMEI模式：IMEI包含字母或与序列号相同且长度不是15位
        isNoIMEIMode: detectNoIMEIMode(data.imei, data.serial_number)
      }

      stockInForm.phones.push(phoneItem)

      // 如果有品牌，加载该品牌的型号缓存
      if (data.brand_id) {
        const brandId = typeof data.brand_id === 'number' ? data.brand_id : parseInt(data.brand_id as string)
        await loadBrandModels(brandId)
      }
    } else {
      ElMessage.error('加载编辑数据失败')
    }
  } catch (error) {
    logger.error('加载编辑数据失败:', error)
    ElMessage.error('加载编辑数据失败')
  }
}

// 检测是否为无IMEI模式
const detectNoIMEIMode = (imei: string | undefined, serialNumber: string | undefined): boolean => {
  if (!imei) return false

  // 1. IMEI包含字母 → 无IMEI模式
  if (/[a-zA-Z]/.test(imei)) {
    return true
  }

  // 2. IMEI与序列号相同且长度不是15位 → 无IMEI模式
  if (imei === serialNumber && imei.length !== 15) {
    return true
  }

  // 3. IMEI长度不是15位 → 无IMEI模式
  if (imei.length !== 15) {
    return true
  }

  return false
}

// 加载品牌的型号列表
const loadBrandModels = async (brandId: number) => {
  // 检查缓存
  if (brandModelsCache.value.has(brandId)) {
    cacheVersion.value++
    return
  }

  try {
    const response = await unifiedApi.get(`/brands/${brandId}/models`)
    if (response.success && response.data) {
      const modelList = Array.isArray(response.data) ? response.data : []
      const brandModels = modelList
        .filter(item => item && item.name)
        .map(item => ({
          id: item.id,
          name: item.name,
          brand_id: item.brand_id
        }))
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))

      brandModelsCache.value.set(brandId, brandModels)
      cacheVersion.value++
    }
  } catch (error) {
    logger.error(`加载品牌 ID ${brandId} 的型号失败:`, error)
  }
}

// 加载下拉数据 - 参考StockInPage的实现
const loadDropdownData = async () => {
  try {
    const requests = []

    // 必需的基础数据 - 使用与StockInPage相同的API端点
    requests.push(unifiedApi.get('/suppliers?limit=10000'))
    requests.push(unifiedApi.get('/stores?all=true'))
    requests.push(unifiedApi.get('/brands?status=1&limit=100'))
    requests.push(unifiedApi.get('/models?status=1&limit=100'))
    requests.push(unifiedApi.get('/colors?limit=100'))
    requests.push(unifiedApi.get('/memories?limit=100'))

    const results = await Promise.all(requests)

    // 按顺序处理API结果
    let resultIndex = 0

    // 处理供应商数据
    const suppliersRes = results[resultIndex++]
    if (suppliersRes.success) {
      suppliers.value = (suppliersRes.data || [])
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
    }

    // 处理门店数据 - 按 sort_order 排序
    const storesRes = results[resultIndex++]
    if (storesRes.success) {
      let storesArray = Array.isArray(storesRes.data) ? storesRes.data : (storesRes.data?.stores || storesRes.data?.data || [])
      stores.value = storesArray
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
    } else {
      stores.value = []
    }

    // 处理品牌数据 - 先按 sort_order 排序，再按名称排序
    const brandsRes = results[resultIndex++]
    if (brandsRes.success) {
      brands.value = extractResponseData<any[]>(brandsRes)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(brand => ({
          id: brand.id,
          name: brand.name
        }))
    }

    // 处理型号数据 - 先按 sort_order 排序，再按名称排序
    const modelsRes = results[resultIndex++]
    if (modelsRes.success) {
      const modelsData = extractResponseData<any[]>(modelsRes)
      models.value = modelsData
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(model => ({
          id: model.id,
          name: model.name,
          brand_id: model.brand_id
        }))
    }

    // 处理颜色数据 - 先按 sort_order 排序，再按名称排序
    const colorsRes = results[resultIndex++]
    if (colorsRes.success) {
      colors.value = extractResponseData<any[]>(colorsRes)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(color => ({
          id: color.id,
          name: color.name
        }))
    }

    // 处理内存数据 - 先按 sort_order 排序，再按名称排序
    const memoriesRes = results[resultIndex++]
    if (memoriesRes.success) {
      memories.value = extractResponseData<any[]>(memoriesRes)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(memory => ({
          id: memory.id,
          name: memory.name || memory.capacity,
          capacity: memory.capacity
        }))
    }
  } catch (error) {
    logger.error('加载下拉数据失败:', error)
    ElMessage.error('加载数据失败，请刷新页面重试')
  }
}

// 添加商品
const addPhone = () => {
  stockInForm.phones.push({
    brand: '',
    model: '',
    color: '',
    memory: '',
    serial_number: '',
    imei: '',
    purchase_price: undefined,
    is_published: 1,  // 默认上架
    imeiValid: undefined,
    serialValid: undefined,
    isNoIMEIMode: false
  })
}

// 确认批量添加
const confirmBatchAdd = () => {
  const count = batchCount.value
  if (count && count > 0 && count <= 100) {
    for (let i = 0; i < count; i++) {
      stockInForm.phones.push({
        brand: '',
        model: '',
        color: '',
        memory: '',
        serial_number: '',
        imei: '',
        purchase_price: undefined,
        is_published: 1,  // 默认上架
        imeiValid: undefined,
        serialValid: undefined,
        isNoIMEIMode: false
      })
    }
    ElMessage.success(`已添加 ${count} 条商品`)
    showBatchCountDialog.value = false
  } else {
    ElMessage.warning('请输入有效的数量（1-100）')
  }
}

// 清空所有商品
const clearAllPhones = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有商品吗？此操作不可恢复。',
      '清空确认',
      {
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    stockInForm.phones = []
    addPhone()
    ElMessage.info('已清空所有商品')
  } catch {
    // 用户取消操作
  }
}

// 移除商品
const removePhone = (index: number) => {
  stockInForm.phones.splice(index, 1)
}

// 检查行是否有错误
const hasRowError = (phone: PhoneItem) => {
  // 根据模式验证IMEI
  if (phone.isNoIMEIMode) {
    // 无IMEI模式：IMEI必须与序列号相同
    if (phone.imei && phone.imei !== phone.serial_number) return true
  } else {
    // 标准模式：IMEI必须是15位数字
    if (phone.imei && phone.imei.length !== 15) return true
  }
  // 检查必填字段是否为空
  if (!phone.brand) return true
  if (!phone.model) return true
  if (!phone.color) return true
  if (!phone.memory) return true
  if (!phone.serial_number) return true
  if (!phone.imei) return true
  if (!phone.purchase_price || phone.purchase_price <= 0) return true
  return false
}

// 品牌改变事件 - 清空型号并动态加载该品牌的型号
const handleBrandChange = async (phone: PhoneItem) => {
  phone.model = ''

  if (!phone.brand) return

  // 查找品牌 - phone.brand 现在存储的是 ID
  const brandId = typeof phone.brand === 'number' ? phone.brand : parseInt(phone.brand as string)
  const selectedBrand = brands.value.find(b => b.id === brandId)
  if (!selectedBrand) {
    logger.warn(`❌ 未找到品牌 ID: ${phone.brand}`)
    return
  }

  // 动态加载该品牌的型号（复用loadBrandModels函数）
  await loadBrandModels(selectedBrand.id)
}

// 获取指定手机项的过滤后型号列表 - 支持搜索关键词
const getFilteredModelsForPhone = (phoneIndex: number) => {
  const phone = stockInForm.phones[phoneIndex]
  if (!phone?.brand) return []

  const searchQuery = modelSearchQueries.value.get(phoneIndex) || ''

  // phone.brand 现在存储的是 ID，需要找到对应的品牌对象
  const brandId = typeof phone.brand === 'number' ? phone.brand : parseInt(phone.brand as string)
  const selectedBrand = brands.value.find(b => b.id === brandId)
  if (!selectedBrand) {
    logger.warn(`⚠️ 未找到品牌 ID: "${phone.brand}"`)
    return []
  }

  // 获取该品牌的型号列表
  let modelList: Model[] = []
  if (brandModelsCache.value.has(selectedBrand.id)) {
    modelList = brandModelsCache.value.get(selectedBrand.id) || []
  } else {
    // 降级方案：使用本地 models 数据过滤
    modelList = models.value.filter(model => model.brand_id === selectedBrand.id)
  }

  // 如果没有搜索关键词，返回全部型号（保持 sort_order 排序）
  if (!searchQuery || !searchQuery.trim()) {
    return modelList
  }

  // 根据搜索关键词过滤型号
  const query = searchQuery.toLowerCase().trim().replace(/\s+/g, '')

  const filteredModels = modelList.filter(model => {
    const modelName = (model.name || '').toString()

    // 1. 直接包含匹配
    if (modelName.toLowerCase().includes(query)) {
      return true
    }

    // 2. 移除空格后匹配
    const normalizedName = modelName.toLowerCase().replace(/\s+/g, '')
    if (normalizedName.includes(query)) {
      return true
    }

    // 3. 移除特殊字符后匹配
    const cleanedName = normalizedName.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
    const cleanedQuery = query.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
    if (cleanedName.includes(cleanedQuery)) {
      return true
    }

    return false
  })

  // 保持 sort_order 排序
  return filteredModels
}

// 获取指定手机项的过滤后颜色列表
const getFilteredColorsForPhone = (phoneIndex: number) => {
  const searchQuery = colorSearchQueries.value.get(phoneIndex) || ''
  let filteredColors = colors.value

  if (!searchQuery || !searchQuery.trim()) {
    // 无搜索时直接返回（保持 sort_order 排序）
    return filteredColors
  }

  const query = searchQuery.toLowerCase().trim()
  filteredColors = colors.value.filter(color => {
    const colorName = (color.name || '').toString().toLowerCase()
    return colorName.includes(query)
  })

  // 搜索结果保持 sort_order 排序
  return filteredColors
}

// 获取指定手机项的过滤后内存列表
const getFilteredMemoriesForPhone = (phoneIndex: number) => {
  const searchQuery = memorySearchQueries.value.get(phoneIndex) || ''
  let filteredMemories = memories.value

  if (!searchQuery || !searchQuery.trim()) {
    // 无搜索时直接返回（保持 sort_order 排序）
    return filteredMemories
  }

  const query = searchQuery.toLowerCase().trim()
  filteredMemories = memories.value.filter(memory => {
    const memoryName = (memory.name || memory.capacity || '').toString().toLowerCase()
    return memoryName.includes(query)
  })

  // 搜索结果保持 sort_order 排序
  return filteredMemories
}

// 获取过滤后的供应商列表
const getFilteredSuppliers = () => {
  let filteredSuppliers = suppliers.value

  if (!supplierSearchQuery.value || !supplierSearchQuery.value.trim()) {
    // 无搜索时直接返回（保持 sort_order 排序）
    return filteredSuppliers
  }

  const query = supplierSearchQuery.value.toLowerCase().trim()
  filteredSuppliers = suppliers.value.filter(supplier => {
    const supplierName = (supplier.name || '').toString().toLowerCase()
    return supplierName.includes(query)
  })

  // 搜索结果保持 sort_order 排序
  return filteredSuppliers
}

// 获取过滤后的店铺列表
const getFilteredStores = () => {
  let filteredStores = stores.value

  if (!storeSearchQuery.value || !storeSearchQuery.value.trim()) {
    // 无搜索时直接返回（保持 sort_order 排序）
    return filteredStores
  }

  const query = storeSearchQuery.value.toLowerCase().trim()
  filteredStores = stores.value.filter(store => {
    const storeName = (store.name || '').toString().toLowerCase()
    return storeName.includes(query)
  })

  // 搜索结果保持 sort_order 排序
  return filteredStores
}

// filter-method 包装函数
const handleSupplierFilter = (query: string) => {
  supplierSearchQuery.value = query
  return true
}

const handleStoreFilter = (query: string) => {
  storeSearchQuery.value = query
  return true
}

const handleModelFilter = (query: string, index: number) => {
  modelSearchQueries.value.set(index, query)
  return true
}

const handleColorFilter = (query: string, index: number) => {
  colorSearchQueries.value.set(index, query)
  return true
}

const handleMemoryFilter = (query: string, index: number) => {
  memorySearchQueries.value.set(index, query)
  return true
}

const handleBrandFilter = (query: string, index: number) => {
  brandSearchQueries.value.set(index, query)
  return true
}

// 获取指定手机项的过滤后品牌列表
const getFilteredBrandsForPhone = (phoneIndex: number) => {
  const searchQuery = brandSearchQueries.value.get(phoneIndex) || ''
  let filteredBrands = brands.value

  if (!searchQuery || !searchQuery.trim()) {
    // 无搜索时直接返回（保持 sort_order 排序）
    return filteredBrands
  }

  const query = searchQuery.toLowerCase().trim()
  filteredBrands = brands.value.filter(brand => {
    const brandName = (brand.name || '').toString().toLowerCase()
    return brandName.includes(query)
  })

  // 搜索结果保持 sort_order 排序
  return filteredBrands
}

// 启用无IMEI模式（双击IMEI输入框触发）
const enableNoIMEIMode = (phone: PhoneItem) => {
  // 切换模式
  phone.isNoIMEIMode = !phone.isNoIMEIMode

  if (phone.isNoIMEIMode) {
    // 启用无IMEI模式：如果有序列号，自动填充IMEI
    if (phone.serial_number) {
      phone.imei = phone.serial_number
      phone.imeiValid = true
    } else {
      phone.imei = ''
      phone.imeiValid = undefined
    }
    ElMessage.success('已启用无IMEI模式，IMEI将支持字母+数字')
  } else {
    // 切换回标准模式：清空IMEI，重新输入15位纯数字
    phone.imei = ''
    phone.imeiValid = undefined
    ElMessage.info('已切换回标准IMEI模式，需要输入15位纯数字')
  }
}

// 格式化IMEI - 根据模式决定格式化规则
const formatIMEI = (phone: PhoneItem) => {
  if (phone.imei) {
    if (phone.isNoIMEIMode) {
      // 无IMEI模式：允许数字和字母，字母转大写
      phone.imei = phone.imei
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 30)
    } else {
      // 标准模式：只允许数字
      phone.imei = phone.imei.replace(/\D/g, '').slice(0, 15)
    }
  }
}

// 验证IMEI - 根据模式决定验证规则
const validateIMEIOnBlur = (phone: PhoneItem) => {
  if (!phone.imei) {
    phone.imeiValid = undefined
  } else if (phone.isNoIMEIMode) {
    // 无IMEI模式：IMEI必须与序列号相同
    phone.imeiValid = (phone.imei === phone.serial_number && phone.imei.length >= 4)
  } else {
    // 标准模式：必须是15位纯数字
    phone.imeiValid = (phone.imei.length === 15 && /^\d{15}$/.test(phone.imei))
  }
}

// 格式化序列号 - 只允许数字和字母，字母自动大写
const formatSerialNumber = (phone: PhoneItem) => {
  if (phone.serial_number) {
    // 只保留数字和字母，移除所有其他字符（包括汉字、特殊字符、空格等），字母转大写
    phone.serial_number = phone.serial_number
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 30)
  }
}

// 验证序列号
const validateSerialOnBlur = (phone: PhoneItem) => {
  if (!phone.serial_number) {
    phone.serialValid = undefined
  } else if (/^[A-Za-z0-9]{4,30}$/.test(phone.serial_number)) {
    phone.serialValid = true
    // 如果是无IMEI模式，同步更新IMEI
    if (phone.isNoIMEIMode) {
      phone.imei = phone.serial_number
      phone.imeiValid = true
    }
  } else {
    phone.serialValid = false
  }
}

// 扫码IMEI
const scanIMEI = (phone: PhoneItem) => {
  currentScanningPhone.value = phone
  currentScanType.value = 'imei'

  // 所有设备都直接使用扫码器
  optimizedScannerVisible.value = true
}

// 扫码序列号
const scanSerialNumber = (phone: PhoneItem) => {
  currentScanningPhone.value = phone
  currentScanType.value = 'serial'

  // 所有设备都直接使用扫码器
  optimizedScannerVisible.value = true
}

// 扫码成功
const handleScanSuccess = (result: string) => {
  if (currentScanningPhone.value) {
    if (currentScanType.value === 'imei') {
      currentScanningPhone.value.imei = result
      validateIMEIOnBlur(currentScanningPhone.value)
    } else if (currentScanType.value === 'serial') {
      currentScanningPhone.value.serial_number = result
      validateSerialOnBlur(currentScanningPhone.value)
    }
  }
  optimizedScannerVisible.value = false
}

// 扫码手动输入
const handleScanManual = () => {
  if (!currentScanningPhone.value) return

  const isIMEI = currentScanType.value === 'imei'

  ElMessageBox.prompt(
    isIMEI ? '请输入IMEI号（15位数字）' : '请输入序列号',
    isIMEI ? 'IMEI手动输入' : '序列号手动输入',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputType: 'text',
      inputPattern: isIMEI ? /^\d{15}$/ : null,
      inputErrorMessage: isIMEI ? '请输入15位数字的IMEI号' : '请输入有效的序列号',
      inputPlaceholder: isIMEI ? '例如：356738110412345' : '请输入设备序列号'
    }
  ).then(({ value }) => {
    if (value && currentScanningPhone.value) {
      handleScanSuccess(value)
    }
  }).catch(() => {
    // 用户取消了输入
  })
}

// 扫码取消
const handleScanCancel = () => {
  optimizedScannerVisible.value = false
}

// 获取价格精度 - 整数时不显示小数位
const getPrecision = (value?: number) => {
  if (value === undefined || value === null || isNaN(value)) return 2
  // 如果是整数，返回0精度；否则返回2精度
  return Number.isInteger(value) ? 0 : 2
}

// 格式化价格显示 - 整数时不显示小数位
const formatPriceValue = (value: number | string | undefined): string => {
  if (value === undefined || value === null || value === '') return ''
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return ''
  // 如果是整数，不显示小数位；否则保留最多2位小数
  return Number.isInteger(numValue) ? numValue.toString() : numValue.toFixed(2).replace(/\.?0+$/, '')
}

// 解析价格输入
const parsePriceValue = (value: string | undefined): number => {
  if (!value) return 0
  const parsed = parseFloat(value)
  return isNaN(parsed) ? 0 : parsed
}

const updatePurchasePrice = (phone: PhoneItem, value: string) => {
  const normalized = value.replace(/[^\d.]/g, '')
  phone.purchase_price = normalized ? parsePriceValue(normalized) : undefined
}

// 关闭对话框
const handleDialogClose = () => {
  dialogVisible.value = false
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    // 验证表单
    const valid = await formRef.value.validate()
    if (!valid) return

    // 编辑模式：只验证单个商品
    // 新增模式：验证所有商品
    if (props.mode === 'create') {
      // 验证每个商品
      for (const phone of stockInForm.phones) {
        if (!phone.brand || !phone.model || !phone.color || !phone.memory) {
          ElMessage.error('请完善商品信息')
          return
        }
        if (!phone.imei || phone.imeiValid === false) {
          ElMessage.error('请输入有效的IMEI号')
          return
        }
        if (!phone.serial_number || phone.serialValid === false) {
          ElMessage.error('请输入有效的序列号')
          return
        }
        if (!phone.purchase_price || phone.purchase_price <= 0) {
          ElMessage.error('请输入有效的入库价格')
          return
        }
      }
    } else {
      // 编辑模式：验证单个商品
      const phone = stockInForm.phones[0]
      if (!phone.brand || !phone.model || !phone.color || !phone.memory) {
        ElMessage.error('请完善商品信息')
        return
      }
      if (!phone.imei || phone.imeiValid === false) {
        ElMessage.error('请输入有效的IMEI号')
        return
      }
      if (!phone.serial_number || phone.serialValid === false) {
        ElMessage.error('请输入有效的序列号')
        return
      }
      if (!phone.purchase_price || phone.purchase_price <= 0) {
        ElMessage.error('请输入有效的入库价格')
        return
      }
    }

    submitting.value = true

    let submitData: any

    if (props.mode === 'create') {
      // 新增模式：批量创建
      submitData = {
        supplier_id: stockInForm.supplier_id,
        store_id: stockInForm.store_id,
        stock_in_date: stockInForm.stock_in_date,
        operator_name: stockInForm.operator_name,
        condition: stockInForm.product_status === '全新' ? '全新' : '二手',
        products: stockInForm.phones.map(phone => ({
          brand_id: phone.brand,
          model_id: phone.model,
          color_id: phone.color,
          memory_id: phone.memory,
          imei: phone.imei,
          serial_number: phone.serial_number,
          purchase_price: phone.purchase_price,
          is_published: phone.is_published ?? 1  // 上架状态，默认1（上架）
        })),
        notes: stockInForm.remarks
      }
    } else {
      // 编辑模式：更新单个记录
      const phone = stockInForm.phones[0]
      submitData = {
        brand_id: phone.brand,
        model_id: phone.model,
        color_id: phone.color,
        memory_id: phone.memory,
        imei: phone.imei,
        serial_number: phone.serial_number,
        purchase_cost: phone.purchase_price,
        store_id: stockInForm.store_id,
        supplier_id: stockInForm.supplier_id,
        is_new: stockInForm.product_status,
        remarks: stockInForm.remarks
      }
    }

    // 提交数据
    const apiUrl = props.mode === 'create' ? '/stock-in' : `/stock-in/${props.editId}`
    const method = props.mode === 'create' ? 'post' : 'put'

    await unifiedApi[method](apiUrl, submitData)

    ElMessage.success(props.mode === 'create' ? '入库成功' : '更新成功')
    emit('success')
    handleDialogClose()
  } catch (error) {
    logger.error('提交失败:', error)
    ElMessage.error('提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

// ==================== 监听器 ====================

watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await initializeData()
      await loadDropdownData()
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
/* ===== Element Plus Dialog 样式说明 ===== */
/* el-dialog 相关的全局样式覆盖已移至组件底部的非 scoped style 块 */
/* 这是因为 Vue 3 的 scoped 样式无法覆盖 Element Plus 的全局 !important 声明 */

/* 自定义头部 */
.stock-in-dialog__header {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 64px;
  padding: 12px 56px 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-sizing: border-box;
}

.stock-in-dialog__title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.02em;
}

/* Dialog 内容 - 由于全局样式已添加 padding，这里设为 0 */
.dialog-body {
  padding: 28px;
  background: #ffffff;
}

/* Dialog 底部 */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;

  .operator-info {
    font-size: 14px;
    color: #6b7280;
  }

  .footer-actions {
    display: flex;
    gap: 12px;
  }
}

/* ===== 信息卡片样式 ===== */
.info-card {
  background: #f8fafc;
  border-radius: 18px;
  overflow: hidden;
  margin-bottom: 24px;
  border: none;
  box-shadow: inset 0 0 0 1px rgba(203, 213, 225, 0.72);
  transition: all 0.24s ease;
}

.info-card:first-child {
  border-top: none;
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
  font-size: 17px;
  font-weight: 700;
  color: #334155;
  margin: 0;
}

.card-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.card-content {
  padding: 22px;
}

/* 表单布局 */
.modern-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modern-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.form-row-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-row-group.three-columns {
  grid-template-columns: 1fr 1fr 1fr;
}

.form-row-group.four-columns {
  grid-template-columns: 1fr 1fr 1fr 1fr;
}

/* 商品列表样式 */
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

.grid-row :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

/* 单列布局 - 用于序列号和IMEI */
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

/* 错误提示样式 */
.error-message {
  font-size: 12px;
  color: #ef4444;
  margin-top: 4px;
  line-height: 1.4;
}

/* 空状态样式 */
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
  margin: 0 0 20px 0;
  font-size: 16px;
}

/* ===== 批量表格样式 ===== */
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
  min-width: 0;
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

.batch-table .col-color {
  width: 10%;
}

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

.batch-table :deep(.el-select) {
  width: 100%;
}

.batch-table :deep(.el-input) {
  width: 100%;
}

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

.batch-table .col-price :deep(.el-input-number) {
  min-width: 120px;
}

/* 表格内输入框字体放大 */
.batch-table :deep(.el-input__wrapper) {
  font-size: 14px;
}

.batch-table :deep(.el-select .el-input__wrapper) {
  font-size: 14px;
}

.batch-table :deep(.el-input-number .el-input__wrapper) {
  font-size: 14px;
}

.batch-table :deep(.el-select__wrapper) {
  font-size: 14px;
}

.batch-table :deep(.el-textarea__inner) {
  font-size: 14px;
}

/* 必填星号样式 */
.batch-table thead th .required {
  color: #ef4444;
  margin-left: 2px;
}

/* 输入框验证样式 */
.batch-table :deep(.el-input.is-error .el-input__wrapper),
.batch-table :deep(.el-select.is-error .el-input__wrapper) {
  border-color: #ef4444 !important;
}

.batch-table :deep(.el-input__wrapper.is-error),
.batch-table :deep(.el-select__wrapper.is-error) {
  border-color: #ef4444 !important;
}

/* 移动端隐藏扫码按钮 */
.batch-table .el-button--icon {
  display: none;
}

/* 移动端优化 */
@media (max-width: 767px) {
  .stock-in-dialog__header {
    min-height: calc(82px + env(safe-area-inset-top));
    padding: calc(18px + env(safe-area-inset-top)) 64px 18px 18px;
  }

  .stock-in-dialog__title {
    font-size: 18px;
    line-height: 1.3;
  }

  .dialog-body {
    padding: 10px 8px 8px;
  }

  .dialog-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;

    .operator-info {
      font-size: 13px;
      text-align: center;
    }

    .footer-actions {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .footer-actions :deep(.el-button) {
      width: 100%;
      min-height: 42px;
      margin: 0;
    }
  }

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
    min-width: 0;
    width: 100%;
    padding-left: 8px;
    padding-right: 8px;
  }

  .card-content {
    padding: 12px 10px 10px;
  }

  .modern-form {
    gap: 12px;
  }

  .modern-form :deep(.el-form-item__label) {
    font-size: 13px;
    line-height: 1.4;
    padding-bottom: 4px;
  }

  .modern-form :deep(.el-input__wrapper),
  .modern-form :deep(.el-select__wrapper),
  .modern-form :deep(.el-date-editor .el-input__wrapper),
  .modern-form :deep(.el-input-number .el-input__wrapper),
  .modern-form :deep(.el-textarea__inner) {
    min-height: 40px;
    border-radius: 12px;
  }

  .form-row-group {
    gap: 10px;
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

  .batch-info {
    font-size: 13px;
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

<!-- 非 scoped 样式：StockInModal 特定样式 -->
<!--
  注意：el-dialog 的基础样式已在全局 styles.css 中统一修复
  这里只保留 StockInModal 组件特有的样式覆盖
-->
<style lang="scss">
.stock-in-dialog {
  --dialog-max-width: 1360px;
  --dialog-side-gap: 20px;
}

.stock-in-mobile-popper .el-select-dropdown__item,
.stock-in-mobile-popper .el-picker-panel__shortcut {
  min-height: 40px;
  height: auto !important;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
  padding-top: 10px;
  padding-bottom: 10px;
}

.stock-in-mobile-popper .el-select-dropdown__wrap {
  max-height: min(320px, 55vh);
}

/* StockInModal 使用自定义 header，需要隐藏默认的头部样式 */
.stock-in-dialog .el-dialog__header {
  display: flex !important;
  align-items: center !important;
  width: 100% !important;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  padding: 12px 56px 12px 16px !important;
  margin: 0 !important;
  border-bottom: none !important;
  box-sizing: border-box !important;
}

.stock-in-dialog .el-dialog__header .el-dialog__title {
  display: block !important;
  color: #ffffff !important;
  font-size: 16px !important;
  font-weight: 700 !important;
  line-height: 1.35 !important;
}

.stock-in-dialog .el-dialog__body {
  padding: 0 0 24px !important;
  background: #ffffff !important;
}

.stock-in-dialog .el-dialog__footer {
  padding: 18px 24px 24px !important;
  background: #ffffff !important;
  border-top: 1px solid rgba(15, 23, 42, 0.06) !important;
}

/* 调整关闭按钮位置，使其在自定义 header 上可见 */
.stock-in-dialog .el-dialog__headerbtn {
  z-index: 1000 !important;
  top: 13px !important;
  right: 14px !important;
  transform: none !important;
}

/* ==================== 删除按钮样式优化 ==================== */

/* 表格中的删除按钮 - 简洁方形设计 */
.stock-in-dialog .delete-row-btn.el-button--danger.el-button--small {
  width: 24px !important;
  height: 24px !important;
  min-width: 24px !important;
  max-width: 24px !important;
  padding: 0 !important;
  background: #f5f5f5 !important;
  border: 1px solid #e0e0e0 !important;
  box-shadow: none !important;
  --el-button-bg-color: #f5f5f5 !important;
  --el-button-border-color: #e0e0e0 !important;
  --el-button-hover-bg-color: #ffebee !important;
  --el-button-hover-border-color: #ffcdd2 !important;
  transition: all 0.2s ease !important;
  border-radius: 4px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* 删除按钮悬停效果 */
.stock-in-dialog .delete-row-btn.el-button--danger.el-button--small:hover {
  background: #ffebee !important;
  border-color: #ffcdd2 !important;
  transform: scale(1.05) !important;
}

/* 删除按钮点击效果 */
.stock-in-dialog .delete-row-btn.el-button--danger.el-button--small:active {
  transform: scale(0.95) !important;
}

/* 减号图标样式 */
.stock-in-dialog .delete-row-btn .delete-icon {
  color: #757575 !important;
  font-size: 16px !important;
  font-weight: bold !important;
  line-height: 1 !important;
  display: block !important;
}

/* 悬停时图标颜色 */
.stock-in-dialog .delete-row-btn.el-button--danger.el-button--small:hover .delete-icon {
  color: #f44336 !important;
}

/* 隐藏原有图标 */
.stock-in-dialog .delete-row-btn .el-icon {
  display: none !important;
}

/* 手机卡片头部中的删除按钮 */
.stock-in-dialog .phone-header .el-button--danger {
  padding: 4px 8px !important;
  height: 28px !important;
  font-size: 13px !important;
}

.stock-in-dialog .phone-header .el-button--danger i {
  font-size: 12px !important;
}

/* 移动端样式 */
@media (max-width: 767px) {
  .stock-in-dialog {
    --dialog-side-gap: 6px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 12px);
    --mobile-dialog-body-padding: 0;
    --mobile-dialog-footer-padding: 0;
  }

  .mobile-dialog-sheet-overlay.stock-in-dialog {
    padding: 12px 6px !important;
  }

  .mobile-dialog-sheet-panel.stock-in-dialog .mobile-dialog-sheet-body,
  .mobile-dialog-sheet-panel.stock-in-dialog .mobile-dialog-sheet-footer {
    padding: 0 !important;
  }

  .stock-in-dialog .el-dialog__footer {
    padding: 12px 10px 10px !important;
  }

  .stock-in-mobile-popper.el-popper,
  .stock-in-mobile-popper.el-select__popper,
  .stock-in-mobile-popper.el-picker__popper {
    width: min(380px, calc(100vw - 12px)) !important;
    max-width: calc(100vw - 12px) !important;
  }

  .stock-in-mobile-popper.el-select__popper .el-select-dropdown,
  .stock-in-mobile-popper.el-select__popper .el-scrollbar,
  .stock-in-mobile-popper.el-select__popper .el-select-dropdown__wrap,
  .stock-in-mobile-popper.el-select__popper .el-select-dropdown__list,
  .stock-in-mobile-popper.el-picker__popper .el-picker-panel,
  .stock-in-mobile-popper.el-picker__popper .el-date-picker,
  .stock-in-mobile-popper.el-picker__popper .el-date-picker__header,
  .stock-in-mobile-popper.el-picker__popper .el-picker-panel__content {
    width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box;
  }

  .stock-in-dialog .delete-row-btn.el-button--danger.el-button--small {
    width: 22px !important;
    height: 22px !important;
    min-width: 22px !important;
    max-width: 22px !important;
  }

  .stock-in-dialog .delete-row-btn .delete-icon {
    font-size: 14px !important;
  }

  .stock-in-dialog .delete-row-btn.el-button--danger.el-button--small:hover .delete-icon {
    color: #f44336 !important;
  }

  .stock-in-dialog .phone-header .el-button--danger {
    padding: 3px 6px !important;
    height: 24px !important;
    font-size: 12px !important;
  }

  .stock-in-dialog .phone-header .el-button--danger i {
    font-size: 11px !important;
  }
}

@media (max-width: 480px) {
  .stock-in-dialog {
    --dialog-side-gap: 4px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 8px);
  }

  .mobile-dialog-sheet-overlay.stock-in-dialog {
    padding: 12px 4px !important;
  }

  .stock-in-mobile-popper.el-popper,
  .stock-in-mobile-popper.el-select__popper,
  .stock-in-mobile-popper.el-picker__popper {
    width: calc(100vw - 12px) !important;
    max-width: calc(100vw - 12px) !important;
  }
}

/* 提示文字样式 */
.field-hint {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
  line-height: 1.4;
}
</style>
