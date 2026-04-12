<!--
  AccessoryStockInModal - 配件入库/编辑模态框

  功能描述：
  - 配件入库：扫码或手动录入配件信息
  - 配件编辑：修改配件基础信息
  - 支持图片上传
  - 支持门店分配
  - 现代化UI设计，响应式布局

  API接口：
  - GET /accessories/barcode/:barcode - 根据条码查询配件
  - POST /accessories/stock-in - 配件入库
  - PUT /accessories/:id - 更新配件
  - GET /options/phone-options - 获取选项数据
  - GET /suppliers - 获取供应商列表
-->
<template>
  <MobileDialog
    v-model="visible"
    :title="isEditMode ? '编辑配件' : '配件入库'"
    :width="isMobile ? '95%' : '900px'"
    :force-fullscreen="isMobile"
    :close-on-click-modal="false"
    dialog-class="accessory-dialog"
    :show-default-footer="false"
    destroy-on-close
    @close="handleDialogClose"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-left">
          <i class="fas fa-boxes"></i>
          <div class="header-text">
            <h3>{{ isEditMode ? '编辑配件' : '配件入库' }}</h3>
            <p>{{ isEditMode ? '修改配件基础信息' : '扫描条形码或手动录入配件信息' }}</p>
          </div>
        </div>
      </div>
    </template>

    <div class="dialog-body">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-position="top"
        class="accessory-form"
      >
        <!-- 扫码和图片区域 -->
        <div class="scan-image-section">
          <div class="scan-area">
            <el-form-item label="条形码">
              <div class="barcode-input-wrapper">
                <el-input
                  v-model="formData.barcode"
                  placeholder="扫描或输入条形码"
                  clearable
                  :disabled="isEditMode"
                  @keyup.enter="!isEditMode && handleBarcodeSearch()"
                >
                  <template #prefix>
                    <i class="fas fa-barcode"></i>
                  </template>
                </el-input>
                <el-button
                  v-if="!isEditMode"
                  type="primary"
                  @click="handleBarcodeSearch"
                  :loading="searching"
                >
                  <i class="fas fa-search"></i>
                  搜索
                </el-button>
              </div>
            </el-form-item>
          </div>

          <div class="image-area">
            <el-form-item label="配件图片">
              <div class="image-upload-wrapper" @click="triggerUpload">
                <el-upload
                  :action="uploadUrl"
                  :headers="uploadHeaders"
                  :show-file-list="false"
                  :before-upload="beforeImageUpload"
                  :on-success="handleImageSuccess"
                  :on-error="handleUploadError"
                  accept="image/*"
                  name="file"
                  :auto-upload="false"
                  ref="uploadRef"
                  class="image-uploader"
                >
                  <div v-if="formData.image_url" class="image-preview">
                    <Image :src="formData.image_url" alt="配件图片" mode="eager" />
                    <div class="image-overlay">
                      <i class="fas fa-camera"></i>
                      <span>更换</span>
                    </div>
                  </div>
                  <div v-else class="image-placeholder">
                    <i class="fas fa-plus"></i>
                    <span>上传图片</span>
                  </div>
                </el-upload>
              </div>
            </el-form-item>
          </div>
        </div>

        <!-- 基本信息卡片 -->
        <div class="info-card">
          <div class="card-header">
            <div class="card-icon">
              <i class="fas fa-info-circle"></i>
            </div>
            <h3 class="card-title">基本信息</h3>
          </div>
          <div class="card-content">
            <el-row :gutter="16">
              <el-col :xs="24" :sm="24" :md="24">
                <el-form-item label="配件名称" prop="name">
                  <el-input
                    v-model="formData.name"
                    placeholder="请输入配件名称"
                    :disabled="!!existingAccessory"
                  />
                </el-form-item>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="分类">
                  <el-select v-model="formData.category" placeholder="选择分类" clearable>
                    <el-option label="保护壳" value="保护壳" />
                    <el-option label="贴膜" value="贴膜" />
                    <el-option label="充电器" value="充电器" />
                    <el-option label="耳机" value="耳机" />
                    <el-option label="数据线" value="数据线" />
                    <el-option label="支架" value="支架" />
                    <el-option label="移动电源" value="移动电源" />
                    <el-option label="其他" value="其他" />
                  </el-select>
                </el-form-item>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="供应商" prop="supplier_id">
                  <el-select v-model="formData.supplier_id" placeholder="选择供应商" clearable filterable>
                    <el-option
                      v-for="supplier in suppliers"
                      :key="supplier.id"
                      :label="supplier.name"
                      :value="supplier.id"
                    />
                  </el-select>
                </el-form-item>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="单位">
                  <el-select v-model="formData.unit" placeholder="选择单位">
                    <el-option label="个" value="个" />
                    <el-option label="套" value="套" />
                    <el-option label="盒" value="盒" />
                    <el-option label="张" value="张" />
                    <el-option label="条" value="条" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </div>

        <!-- 价格信息卡片 -->
        <div class="info-card">
          <div class="card-header">
            <div class="card-icon">
              <i class="fas fa-yen-sign"></i>
            </div>
            <h3 class="card-title">价格信息</h3>
          </div>
          <div class="card-content">
            <el-row :gutter="16">
              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="进价" prop="purchase_price">
                  <el-input-number
                    v-model="formData.purchase_price"
                    :min="0"
                    :precision="0"
                    :step="1"
                    controls-position="right"
                    class="full-width"
                  />
                </el-form-item>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="售价">
                  <el-input-number
                    v-model="formData.selling_price"
                    :min="0"
                    :precision="0"
                    :step="1"
                    controls-position="right"
                    class="full-width"
                  />
                </el-form-item>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="预警值">
                  <el-input-number
                    v-model="formData.min_stock"
                    :min="0"
                    :max="9999"
                    :precision="0"
                    controls-position="right"
                    class="full-width"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </div>

        <!-- 适用机型（可选） -->
        <div class="info-card">
          <div class="card-header">
            <div class="card-icon">
              <i class="fas fa-mobile-alt"></i>
            </div>
            <h3 class="card-title">适用机型 <span class="optional-text">（可选）</span></h3>
          </div>
          <div class="card-content">
            <el-row :gutter="16">
              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="品牌">
                  <el-select v-model="formData.brand_id" placeholder="选择品牌" clearable filterable>
                    <el-option
                      v-for="brand in brands"
                      :key="brand.id"
                      :label="brand.name"
                      :value="brand.id"
                    />
                  </el-select>
                </el-form-item>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="型号">
                  <el-select v-model="formData.model_id" placeholder="选择型号" clearable filterable :disabled="!formData.brand_id">
                    <el-option
                      v-for="model in filteredModels"
                      :key="model.id"
                      :label="model.name"
                      :value="model.id"
                    />
                  </el-select>
                </el-form-item>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="颜色">
                  <el-select v-model="formData.color_id" placeholder="选择颜色" clearable filterable>
                    <el-option
                      v-for="color in colors"
                      :key="color.id"
                      :label="color.name"
                      :value="color.id"
                    />
                  </el-select>
                </el-form-item>
              </el-col>

              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="状态">
                  <el-radio-group v-model="formData.status">
                    <el-radio :value="1">启用</el-radio>
                    <el-radio :value="0">禁用</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </div>

        <!-- 入库分配（仅入库模式） -->
        <div v-if="!isEditMode" class="info-card">
          <div class="card-header">
            <div class="card-icon">
              <i class="fas fa-warehouse"></i>
            </div>
            <h3 class="card-title">入库分配</h3>
          </div>
          <div class="card-content">
            <el-form-item label="入库总数" prop="total_quantity">
              <div class="quantity-input-group">
                <el-input-number
                  v-model="formData.total_quantity"
                  :min="1"
                  :max="9999"
                  :step="1"
                  controls-position="right"
                  @change="handleTotalQuantityChange"
                />
                <span class="unit-tag">{{ formData.unit || '个' }}</span>
              </div>
            </el-form-item>

            <el-form-item label="门店分配">
              <div class="distribution-list">
                <div class="distribution-header">
                  <span>门店名称</span>
                  <span>分配数量</span>
                  <span>金额</span>
                </div>
                <div
                  v-for="store in stores"
                  :key="store.id"
                  class="distribution-item"
                  :class="{ active: store.checked }"
                >
                  <el-checkbox
                    v-model="store.checked"
                    :disabled="!formData.total_quantity"
                    @change="handleStoreCheck(store)"
                  >
                    {{ store.name }}
                  </el-checkbox>
                  <el-input-number
                    v-model="store.quantity"
                    :min="0"
                    :max="formData.total_quantity"
                    :disabled="!store.checked"
                    @change="handleDistributionChange"
                    size="small"
                    controls-position="right"
                  />
                  <span class="item-amount">¥{{ ((store.quantity || 0) * formData.purchase_price).toLocaleString() }}</span>
                </div>
              </div>

              <div class="distribution-status" :class="{ complete: isDistributionComplete }">
                <i class="fas fa-info-circle"></i>
                <span>已分配 <strong>{{ distributedQuantity }}</strong> / {{ formData.total_quantity }}</span>
                <span v-if="!isDistributionComplete" class="remaining-hint">剩余 {{ formData.total_quantity - distributedQuantity }} 存入当前门店</span>
              </div>
            </el-form-item>
          </div>
        </div>

        <!-- 备注 -->
        <div class="info-card">
          <div class="card-header">
            <div class="card-icon">
              <i class="fas fa-sticky-note"></i>
            </div>
            <h3 class="card-title">备注信息</h3>
          </div>
          <div class="card-content">
            <el-form-item label="备注">
              <el-input
                v-model="formData.remarks"
                type="textarea"
                :rows="2"
                placeholder="请输入备注信息（可选）"
              />
            </el-form-item>
          </div>
        </div>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button type="default" @click="handleClose" size="large">
          <i class="fas fa-times"></i>
          取消
        </el-button>
        <el-button
          type="primary"
          @click="handleSubmit"
          :loading="submitting"
          :disabled="!canSubmit"
          size="large"
        >
          <i class="fas fa-check"></i>
          {{ isEditMode ? '保存' : '确认入库' }}
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'
import type { ModelValueProps, UpdateModelValueEmits, SuccessEmits, CloseEmits } from '@/types/component'
import Image from './Image.vue'
import { storage } from '@/services/storage'

// Props
interface Props extends ModelValueProps {
  accessory?: any
}

type Emits = UpdateModelValueEmits & SuccessEmits & CloseEmits

const emit = defineEmits<Emits>()

const props = defineProps<Props>()
const authStore = useAuthStore()

// 表单引用
const formRef = ref<FormInstance>()

// 编辑模式判断
const isEditMode = computed(() => !!props.accessory && !!props.accessory.id)

// 响应式数据
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const searching = ref(false)
const submitting = ref(false)
const existingAccessory = ref(null)

// 表单数据
const formData = ref({
  barcode: '',
  accessory_id: null as number | null,
  id: null as number | null,
  name: '',
  category: '',
  brand_id: null as number | null,
  model_id: null as number | null,
  color_id: null as number | null,
  supplier_id: null as number | null,
  purchase_price: 0,
  selling_price: 0,
  unit: '个',
  specifications: '',
  status: 1,
  min_stock: 5,
  image_url: '',
  total_quantity: 1,
  store_id: null as number | null,
  distribution: [] as any[],
  remarks: ''
})

// 表单验证规则
const formRules = {
  name: [{ required: true, message: '请输入配件名称', trigger: 'blur' }],
  supplier_id: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  purchase_price: [{ required: true, message: '请输入进价', trigger: 'blur' }],
  total_quantity: [{ required: true, message: '请输入入库数量', trigger: 'blur' }]
}

// 下拉选项数据
const brands = ref([])
const models = ref([])
const colors = ref([])
const suppliers = ref([])
const stores = ref([])

// 计算属性
const filteredModels = computed(() => {
  if (!formData.value.brand_id) return []
  return models.value.filter(m => m.brand_id === formData.value.brand_id)
})

const distributedQuantity = computed(() => {
  return stores.value
    .filter(s => s.checked)
    .reduce((sum, s) => sum + (s.quantity || 0), 0)
})

const isDistributionComplete = computed(() => {
  return distributedQuantity.value === formData.value.total_quantity
})

const canSubmit = computed(() => {
  if (isEditMode.value) {
    return formData.value.name
  }
  return (
    formData.value.name &&
    formData.value.supplier_id &&
    formData.value.purchase_price >= 0 &&
    formData.value.total_quantity > 0 &&
    formData.value.store_id
  )
})

const isMobile = computed(() => window.innerWidth < 768)

// 图片显示 URL - 使用统一的图片URL处理函数
const displayImageUrl = computed(() => {
  return formatImageUrl(formData.value.image_url)
})

// 图片上传配置
const uploadUrl = computed(() => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  if (apiBaseUrl.startsWith('http')) {
    return `${apiBaseUrl}/accessories/upload`
  }
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
const beforeImageUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    ElMessage.error('只能上传图片文件！')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB！')
    return false
  }
  return true
}

// 图片上传成功
const handleImageSuccess = (response) => {
  if (response.success && response.data?.url) {
    formData.value.image_url = response.data.url
    ElMessage.success('图片上传成功')
  } else {
    ElMessage.error('图片上传失败')
  }
}

// 图片上传失败
const handleUploadError = () => {
  ElMessage.error('图片上传失败，请重试')
}

// 图片加载错误处理
const handleImageError = (event) => {
  logger.warn('图片加载失败:', formData.value.image_url)
  event.target.style.display = 'none'
}

// 触发上传
const triggerUpload = () => {
  // @ts-ignore - 复杂选择器类型检查问题，运行时正常工作
  const uploadInput = document.querySelector('.image-uploader input[type="file"]')
  uploadInput?.click()
}

// 加载数据
const loadBrands = async () => {
  try {
    const response = await unifiedApi.get('/options/phone-options')
    brands.value = (response.data?.brands || [])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  } catch (err) {
    logger.error('加载品牌失败', err)
  }
}

const loadModels = async () => {
  try {
    const response = await unifiedApi.get('/options/phone-options')
    models.value = (response.data?.models || [])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  } catch (err) {
    logger.error('加载型号失败', err)
  }
}

const loadColors = async () => {
  try {
    const response = await unifiedApi.get('/options/phone-options')
    colors.value = (response.data?.colors || [])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  } catch (err) {
    logger.error('加载颜色失败', err)
  }
}

const loadSuppliers = async () => {
  try {
    const response = await unifiedApi.get('/suppliers', {
      params: { limit: 10000, all: true }
    })
    suppliers.value = (response.data || [])
      .filter(s => s.status === 1)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  } catch (err) {
    logger.error('加载供应商失败', err)
  }
}

const loadStores = async () => {
  try {
    const response = await unifiedApi.get('/options/phone-options')
    const storeOptions = (response.data?.stores || [])

    stores.value = storeOptions
      .map(s => ({
        ...s,
        checked: false,
        quantity: 0
      }))

    if (stores.value.length > 0) {
      const userStoreId = authStore.user?.store_id
      const defaultStore = stores.value.find(s => s.id === userStoreId) || stores.value[0]
      formData.value.store_id = defaultStore.id
    }
  } catch (err) {
    logger.error('加载门店失败', err)
  }
}

// 条码搜索
const handleBarcodeSearch = async () => {
  if (!formData.value.barcode) {
    ElMessage.warning('请输入或扫描条形码')
    return
  }

  searching.value = true
  try {
    const encodedBarcode = encodeURIComponent(formData.value.barcode)
    const response = await unifiedApi.get(`/accessories/barcode/${encodedBarcode}`)
    if (response.data) {
      existingAccessory.value = response.data
      formData.value.accessory_id = response.data.id
      formData.value.name = response.data.name
      formData.value.category = response.data.category
      formData.value.brand_id = response.data.brand_id
      formData.value.model_id = response.data.model_id
      formData.value.color_id = response.data.color_id
      formData.value.supplier_id = response.data.supplier_id
      formData.value.purchase_price = response.data.purchase_price || 0
      formData.value.selling_price = response.data.selling_price || 0
      formData.value.unit = response.data.unit || '个'
      formData.value.specifications = response.data.specifications || ''
      ElMessage.success('找到配件：' + response.data.name)
    }
  } catch (err) {
    existingAccessory.value = null
    formData.value.accessory_id = null
    ElMessage.info('未找到该配件，将创建新配件')
  } finally {
    searching.value = false
  }
}

// 数量和分配处理
const handleTotalQuantityChange = () => {
  stores.value.forEach(s => {
    s.quantity = 0
  })
}

const handleStoreCheck = (store) => {
  if (!store.checked) {
    store.quantity = 0
  }
}

const handleDistributionChange = () => {
  // 计算更新
}

// 提交
const handleSubmit = async () => {
  if (!canSubmit.value) {
    ElMessage.warning(isEditMode.value ? '请完善配件信息' : '请完善入库信息')
    return
  }

  submitting.value = true
  try {
    if (isEditMode.value) {
      const updateData = {}

      const allowedFields = [
        'name', 'barcode', 'category', 'brand_id', 'model_id', 'color_id',
        'supplier_id', 'purchase_price', 'selling_price', 'specifications',
        'unit', 'status', 'description', 'remarks', 'image_url'
      ]

      allowedFields.forEach(field => {
        if (formData.value[field] !== undefined && formData.value[field] !== '') {
          updateData[field] = formData.value[field]
        }
      })

      await unifiedApi.put(`/accessories/${formData.value.id}`, updateData)
      ElMessage.success('更新成功！')
    } else {
      const distribution = stores.value
        .filter(s => s.checked && s.quantity > 0)
        .map(s => ({
          store_id: s.id,
          store_name: s.name,
          quantity: s.quantity
        }))

      const data = {
        ...formData.value,
        distribution,
        operator_id: authStore.user?.id,
        operator_name: authStore.user?.name || authStore.user?.username
      }

      await unifiedApi.post('/accessories/stock-in', data)
      ElMessage.success('入库成功！')
    }
    handleClose()
    emit('success')
  } catch (err) {
    logger.error(isEditMode.value ? '更新失败' : '入库失败', err)
    ElMessage.error(err.response?.data?.message || (isEditMode.value ? '更新失败' : '入库失败') + '，请重试')
  } finally {
    submitting.value = false
  }
}

const handleDialogClose = () => {
  resetFormData()
}

const handleClose = () => {
  visible.value = false
}

const resetFormData = () => {
  formData.value = {
    barcode: '',
    accessory_id: null,
    id: null,
    name: '',
    category: '',
    brand_id: null,
    model_id: null,
    color_id: null,
    supplier_id: null,
    purchase_price: 0,
    selling_price: 0,
    unit: '个',
    specifications: '',
    status: 1,
    min_stock: 5,
    image_url: '',
    total_quantity: 1,
    store_id: null,
    distribution: [],
    remarks: ''
  }
  existingAccessory.value = null

  if (stores.value.length > 0) {
    const userStoreId = authStore.user?.store_id
    const defaultStore = stores.value.find(s => s.id === userStoreId) || stores.value[0]
    formData.value.store_id = defaultStore.id
  }

  stores.value.forEach(s => {
    s.checked = false
    s.quantity = 0
  })
}

watch(() => formData.value.brand_id, () => {
  formData.value.model_id = null
})

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      if (props.accessory && props.accessory.id) {
        formData.value = {
          id: props.accessory.id,
          barcode: props.accessory.barcode || '',
          accessory_id: props.accessory.id,
          name: props.accessory.name || '',
          category: props.accessory.category || '',
          brand_id: props.accessory.brand_id || null,
          model_id: props.accessory.model_id || null,
          color_id: props.accessory.color_id || null,
          supplier_id: props.accessory.supplier_id || null,
          purchase_price: Number(props.accessory.purchase_price) || 0,
          selling_price: Number(props.accessory.selling_price) || 0,
          unit: props.accessory.unit || '个',
          specifications: props.accessory.specifications || '',
          status: props.accessory.status !== undefined ? props.accessory.status : 1,
          min_stock: Number(props.accessory.min_stock) || 5,
          image_url: props.accessory.image_url || '',
          total_quantity: 1,
          store_id: null,
          distribution: [],
          remarks: props.accessory.remarks || ''
        }
      } else {
        resetFormData()
      }
    }
  }
)

onMounted(async () => {
  await Promise.all([
    loadBrands(),
    loadModels(),
    loadColors(),
    loadSuppliers(),
    loadStores()
  ])
})
</script>

<style scoped>
/* 配件模态框 - 参考项目统一风格 */
.accessory-dialog :deep(.el-dialog__header) {
  padding: 0;
  margin-bottom: 20px;
}

.accessory-dialog :deep(.el-dialog__title) {
  display: none;
}

.accessory-dialog :deep(.el-dialog__body) {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.accessory-dialog :deep(.el-dialog__footer) {
  padding: 16px 20px;
  border-top: 1px solid #ebeef5;
}

/* 模态框头部 */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left i {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 10px;
  font-size: 18px;
}

.header-text h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.header-text p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
}

/* 模态框主体 */
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 扫码和图片区域 */
.scan-image-section {
  display: grid;
  grid-template-columns: 1fr 140px;
  gap: 16px;
}

.image-area {
  display: flex;
  flex-direction: column;
}

.image-upload-wrapper {
  width: 140px;
  height: 140px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s;
}

.image-upload-wrapper:hover {
  border-color: #667eea;
}

.image-preview {
  width: 100%;
  height: 100%;
  position: relative;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  transition: opacity 0.3s;
}

.image-upload-wrapper:hover .image-overlay {
  opacity: 1;
}

.image-overlay i {
  font-size: 20px;
  margin-bottom: 4px;
}

.image-overlay span {
  font-size: 12px;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #fafafa;
  color: #909399;
}

.image-placeholder i {
  font-size: 24px;
}

.image-placeholder span {
  font-size: 12px;
}

/* 条码输入 */
.barcode-input-wrapper {
  display: flex;
  gap: 10px;
}

.barcode-input-wrapper .el-input {
  flex: 1;
}

/* 信息卡片 */
.info-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.card-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  font-size: 14px;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.optional-text {
  font-weight: 400;
  font-size: 13px;
  opacity: 0.8;
}

.card-content {
  padding: 16px;
}

/* 表单样式 */
.accessory-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #606266;
}

.accessory-form :deep(.el-input__wrapper),
.accessory-form :deep(.el-select .el-input__wrapper),
.accessory-form :deep(.el-textarea__inner) {
  border-radius: 6px;
}

.full-width {
  width: 100%;
}

/* 数量输入 */
.quantity-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quantity-input-group .el-input-number {
  flex: 1;
}

.unit-tag {
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

/* 分配列表 */
.distribution-list {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;
}

.distribution-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 12px;
  padding: 10px 14px;
  background: #f5f7fa;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.distribution-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 12px;
  padding: 10px 14px;
  border-top: 1px solid #ebeef5;
  align-items: center;
  transition: all 0.3s;
}

.distribution-item:first-of-type {
  border-top: none;
}

.distribution-item.active {
  background: #f0f9ff;
}

.item-amount {
  color: #67c23a;
  font-weight: 500;
  font-size: 14px;
}

/* 分配状态 */
.distribution-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-top: 12px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 6px;
  color: #1890ff;
  font-size: 13px;
}

.distribution-status.complete {
  background: #f6ffed;
  border-color: #b7eb8f;
  color: #52c41a;
}

.distribution-status strong {
  font-size: 15px;
}

.remaining-hint {
  margin-left: auto;
  opacity: 0.8;
  font-size: 12px;
}

/* 底部按钮 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dialog-footer .el-button {
  min-width: 100px;
  border-radius: 6px;
}

.dialog-footer .el-button i {
  margin-right: 4px;
}

/* 响应式 */
@media (max-width: 768px) {
  .scan-image-section {
    grid-template-columns: 1fr;
  }

  .image-upload-wrapper {
    width: 100%;
    height: 150px;
  }

  .distribution-header,
  .distribution-item {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .distribution-header {
    display: none;
  }

  .distribution-item {
    flex-direction: column;
    align-items: flex-start;
    padding: 12px;
  }

  .dialog-footer {
    flex-direction: column;
  }

  .dialog-footer .el-button {
    width: 100%;
  }
}
</style>
