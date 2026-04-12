# 模态框使用示例

> **文档说明**：TF2025 项目中模态框组件的详细使用示例
>
> **最后更新**：2025-12-20
> **版本**：v2.0.0
> **维护者**：TF2025 开发团队

## 📋 目录

- [基础弹窗](#基础弹窗)
- [表单弹窗](#表单弹窗)
- [确认弹窗](#确认弹窗)
- [详情弹窗](#详情弹窗)
- [多步骤弹窗](#多步骤弹窗)
- [全屏弹窗](#全屏弹窗)
- [自定义弹窗](#自定义弹窗)

---

## 基础弹窗

### 1. 简单信息展示

```vue
<!-- views/example/BasicInfoModal.vue -->
<template>
  <el-button @click="showInfo = true">查看信息</el-button>

  <MobileDialog
    v-model="showInfo"
    title="系统信息"
    width="500px"
    :show-footer="false"
  >
    <div class="info-content">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="系统版本">
          TF2025 v2.0.0
        </el-descriptions-item>
        <el-descriptions-item label="最后更新">
          2025-12-20
        </el-descriptions-item>
        <el-descriptions-item label="部署环境">
          生产环境
        </el-descriptions-item>
        <el-descriptions-item label="数据库版本">
          MySQL 8.0
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'

const showInfo = ref(false)
</script>

<style lang="scss" scoped>
.info-content {
  padding: var(--spacing-md) 0;
}
</style>
```

### 2. 带图标的提示弹窗

```vue
<!-- views/example/IconModal.vue -->
<template>
  <div class="icon-modal-demo">
    <el-button @click="showSuccess">成功提示</el-button>
    <el-button @click="showWarning">警告提示</el-button>
    <el-button @click="showError">错误提示</el-button>
  </div>

  <!-- 成功提示 -->
  <MobileDialog
    v-model="successVisible"
    title="操作成功"
    width="400px"
    :show-footer="false"
  >
    <div class="icon-content success">
      <el-icon class="success-icon"><CircleCheckFilled /></el-icon>
      <p>数据已成功保存！</p>
    </div>
  </MobileDialog>

  <!-- 警告提示 -->
  <MobileDialog
    v-model="warningVisible"
    title="警告"
    width="400px"
    :show-footer="false"
  >
    <div class="icon-content warning">
      <el-icon class="warning-icon"><WarningFilled /></el-icon>
      <p>此操作可能会影响其他数据，请谨慎操作！</p>
    </div>
  </MobileDialog>

  <!-- 错误提示 -->
  <MobileDialog
    v-model="errorVisible"
    title="错误"
    width="400px"
    :show-footer="false"
  >
    <div class="icon-content error">
      <el-icon class="error-icon"><CircleCloseFilled /></el-icon>
      <p>操作失败，请稍后重试！</p>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  CircleCheckFilled,
  WarningFilled,
  CircleCloseFilled
} from '@element-plus/icons-vue'
import MobileDialog from '@/components/MobileDialog.vue'

const successVisible = ref(false)
const warningVisible = ref(false)
const errorVisible = ref(false)

const showSuccess = () => {
  successVisible.value = true
}

const showWarning = () => {
  warningVisible.value = true
}

const showError = () => {
  errorVisible.value = true
}
</script>

<style lang="scss" scoped>
.icon-modal-demo {
  display: flex;
  gap: var(--spacing-md);
}

.icon-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-xl) 0;

  .el-icon {
    font-size: 48px;
    margin-bottom: var(--spacing-md);

    &.success-icon {
      color: var(--color-success);
    }

    &.warning-icon {
      color: var(--color-warning);
    }

    &.error-icon {
      color: var(--color-danger);
    }
  }

  p {
    margin: 0;
    text-align: center;
    color: var(--color-text-regular);
    line-height: var(--line-height-normal);
  }
}
</style>
```

---

## 表单弹窗

### 1. 简单表单

```vue
<!-- views/example/SimpleFormModal.vue -->
<template>
  <el-button type="primary" @click="showForm = true">添加备注</el-button>

  <MobileDialog
    v-model="showForm"
    title="添加备注"
    width="600px"
    @confirm="handleSubmit"
  >
    <MobileForm
      ref="formRef"
      v-model="formData"
      :fields="formFields"
      :rules="formRules"
    />
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import MobileDialog from '@/components/MobileDialog.vue'
import MobileForm from '@/components/MobileForm.vue'
import type { FormField, FormRule } from '@/types'

const showForm = ref(false)
const formRef = ref()

// 表单数据
const formData = ref({
  title: '',
  content: '',
  priority: 'normal',
  tags: []
})

// 表单字段
const formFields: FormField[] = [
  {
    prop: 'title',
    label: '标题',
    type: 'input',
    required: true,
    attrs: {
      placeholder: '请输入备注标题',
      maxlength: 50,
      showWordLimit: true
    }
  },
  {
    prop: 'content',
    label: '内容',
    type: 'textarea',
    required: true,
    attrs: {
      placeholder: '请输入备注内容',
      rows: 4,
      maxlength: 200,
      showWordLimit: true
    }
  },
  {
    prop: 'priority',
    label: '优先级',
    type: 'select',
    options: [
      { label: '低', value: 'low' },
      { label: '中', value: 'normal' },
      { label: '高', value: 'high' }
    ]
  },
  {
    prop: 'tags',
    label: '标签',
    type: 'select',
    attrs: {
      multiple: true,
      filterable: true,
      allowCreate: true,
      placeholder: '请选择或创建标签'
    }
  }
]

// 表单规则
const formRules: FormRule = {
  title: [
    { required: true, message: '请输入标题', trigger: 'blur' }
  ],
  content: [
    { required: true, message: '请输入内容', trigger: 'blur' }
  ]
}

// 提交处理
const handleSubmit = async () => {
  if (!formRef.value) return

  const valid = await formRef.value.validate()
  if (!valid) return

  try {
    // 提交 API
    await unifiedApi.post('/notes', formData.value)

    ElMessage.success('添加成功')
    showForm.value = false

    // 重置表单
    formData.value = {
      title: '',
      content: '',
      priority: 'normal',
      tags: []
    }
  } catch (error) {
    ElMessage.error('添加失败')
  }
}
</script>
```

### 2. 复杂表单（带步骤）

```vue
<!-- views/example/ComplexFormModal.vue -->
<template>
  <el-button type="primary" @click="openDialog">创建订单</el-button>

  <MobileDialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="800px"
    :before-close="handleBeforeClose"
  >
    <!-- 步骤指示器 -->
    <el-steps :active="currentStep" align-center class="order-steps">
      <el-step title="选择客户" />
      <el-step title="选择商品" />
      <el-step title="确认信息" />
    </el-steps>

    <!-- 步骤内容 -->
    <div class="step-content">
      <!-- 第一步：选择客户 -->
      <div v-show="currentStep === 0" class="step-customer">
        <MobileForm
          ref="customerFormRef"
          v-model="orderData.customer"
          :fields="customerFields"
          :rules="customerRules"
        />
      </div>

      <!-- 第二步：选择商品 -->
      <div v-show="currentStep === 1" class="step-products">
        <ProductSelector
          v-model="orderData.items"
          :customer-id="orderData.customer.id"
        />
      </div>

      <!-- 第三步：确认信息 -->
      <div v-show="currentStep === 2" class="step-summary">
        <OrderSummary
          :customer="orderData.customer"
          :items="orderData.items"
          :total="orderTotal"
        />
      </div>
    </div>

    <!-- 自定义底部按钮 -->
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button
          v-if="currentStep > 0"
          @click="handlePrev"
        >
          上一步
        </el-button>
        <el-button
          v-if="currentStep < 2"
          type="primary"
          @click="handleNext"
        >
          下一步
        </el-button>
        <el-button
          v-if="currentStep === 2"
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          提交订单
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import MobileDialog from '@/components/MobileDialog.vue'
import MobileForm from '@/components/MobileForm.vue'
import ProductSelector from './ProductSelector.vue'
import OrderSummary from './OrderSummary.vue'

const dialogVisible = ref(false)
const currentStep = ref(0)
const submitting = ref(false)

// 订单数据
const orderData = ref({
  customer: {
    id: null,
    name: '',
    phone: ''
  },
  items: []
})

// 对话框标题
const dialogTitle = computed(() => {
  return '创建销售订单'
})

// 客户表单字段
const customerFields = [
  {
    prop: 'id',
    label: '客户',
    type: 'select',
    required: true,
    attrs: {
      placeholder: '请选择客户',
      filterable: true,
      remote: true
    }
  }
]

// 客户验证规则
const customerRules = {
  id: [
    { required: true, message: '请选择客户', trigger: 'change' }
  ]
}

// 订单总金额
const orderTotal = computed(() => {
  return orderData.value.items.reduce((total, item) => {
    return total + (item.price * item.quantity)
  }, 0)
})

// 打开对话框
const openDialog = () => {
  dialogVisible.value = true
  currentStep.value = 0
}

// 关闭前确认
const handleBeforeClose = async () => {
  if (hasUnsavedChanges.value) {
    try {
      await ElMessageBox.confirm(
        '您有未保存的更改，确定要关闭吗？',
        '提示',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      return false
    }
  }
  dialogVisible.value = false
}

// 检查是否有未保存的更改
const hasUnsavedChanges = computed(() => {
  return orderData.value.customer.id || orderData.value.items.length > 0
})

// 下一步
const handleNext = async () => {
  if (currentStep.value === 0) {
    // 验证客户信息
    const valid = await validateCustomer()
    if (!valid) return
  }

  currentStep.value++
}

// 上一步
const handlePrev = () => {
  currentStep.value--
}

// 取消
const handleCancel = async () => {
  await handleBeforeClose()
}

// 提交订单
const handleSubmit = async () => {
  submitting.value = true

  try {
    const payload = {
      customer_id: orderData.value.customer.id,
      items: orderData.value.items,
      total_amount: orderTotal.value
    }

    await unifiedApi.post('/sales/orders', payload)

    ElMessage.success('订单创建成功')
    dialogVisible.value = false
  } catch (error) {
    ElMessage.error('订单创建失败')
  } finally {
    submitting.value = false
  }
}

// 验证客户信息
const validateCustomer = async () => {
  // 实现验证逻辑
  return true
}
</script>

<style lang="scss" scoped>
.order-steps {
  margin: var(--spacing-lg) 0;
}

.step-content {
  min-height: 300px;
  padding: var(--spacing-lg) 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);

  @include mobile-only {
    flex-direction: column-reverse;

    .el-button {
      width: 100%;
    }
  }
}
</style>
```

---

## 确认弹窗

### 1. 简单确认

```vue
<!-- views/example/ConfirmationModal.vue -->
<template>
  <div class="confirmation-demo">
    <el-button @click="handleDelete">删除记录</el-button>
    <el-button type="danger" @click="handleBatchDelete">批量删除</el-button>
    <el-button type="warning" @click="handleReset">重置数据</el-button>
  </div>

  <!-- 删除确认 -->
  <MobileDialog
    v-model="deleteVisible"
    title="确认删除"
    width="400px"
    @confirm="confirmDelete"
  >
    <div class="confirm-content">
      <el-icon class="warning-icon"><WarningFilled /></el-icon>
      <p>确定要删除这条记录吗？此操作不可恢复。</p>
    </div>
  </MobileDialog>

  <!-- 批量删除确认 -->
  <MobileDialog
    v-model="batchDeleteVisible"
    title="批量删除确认"
    width="450px"
    @confirm="confirmBatchDelete"
  >
    <div class="confirm-content">
      <el-icon class="warning-icon"><WarningFilled /></el-icon>
      <div class="confirm-details">
        <p>您即将删除 <strong>{{ selectedCount }}</strong> 条记录。</p>
        <p class="warning-text">此操作不可恢复，请谨慎操作！</p>
      </div>
    </div>
  </MobileDialog>

  <!-- 重置确认 -->
  <MobileDialog
    v-model="resetVisible"
    title="重置确认"
    width="400px"
    type="warning"
    @confirm="confirmReset"
  >
    <div class="confirm-content">
      <el-icon class="reset-icon"><RefreshRight /></el-icon>
      <p>确定要重置所有数据吗？</p>
      <p class="tip-text">重置后数据将恢复到初始状态。</p>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { WarningFilled, RefreshRight } from '@element-plus/icons-vue'
import MobileDialog from '@/components/MobileDialog.vue'

const deleteVisible = ref(false)
const batchDeleteVisible = ref(false)
const resetVisible = ref(false)
const selectedCount = ref(5)

// 删除记录
const handleDelete = () => {
  deleteVisible.value = true
}

const confirmDelete = async () => {
  try {
    // 调用删除 API
    await unifiedApi.delete('/records/123')

    ElMessage.success('删除成功')
    deleteVisible.value = false
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

// 批量删除
const handleBatchDelete = () => {
  batchDeleteVisible.value = true
}

const confirmBatchDelete = async () => {
  try {
    // 调用批量删除 API
    await unifiedApi.delete('/records/batch', {
      data: { ids: [1, 2, 3, 4, 5] }
    })

    ElMessage.success('批量删除成功')
    batchDeleteVisible.value = false
  } catch (error) {
    ElMessage.error('批量删除失败')
  }
}

// 重置数据
const handleReset = () => {
  resetVisible.value = true
}

const confirmReset = async () => {
  try {
    // 调用重置 API
    await unifiedApi.post('/data/reset')

    ElMessage.success('重置成功')
    resetVisible.value = false
  } catch (error) {
    ElMessage.error('重置失败')
  }
}
</script>

<style lang="scss" scoped>
.confirmation-demo {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.confirm-content {
  text-align: center;

  .el-icon {
    font-size: 48px;
    margin-bottom: var(--spacing-md);

    &.warning-icon {
      color: var(--color-warning);
    }

    &.reset-icon {
      color: var(--color-info);
    }
  }

  .confirm-details {
    p {
      margin: var(--spacing-xs) 0;

      &.warning-text {
        color: var(--color-danger);
        font-weight: var(--font-weight-medium);
      }

      strong {
        color: var(--color-danger);
      }
    }
  }

  .tip-text {
    color: var(--color-text-secondary);
    font-size: var(--font-sm);
  }
}
</style>
```

### 2. 自定义确认内容

```vue
<!-- views/example/CustomConfirmModal.vue -->
<template>
  <el-button type="danger" @click="showCustomConfirm">
    自定义确认弹窗
  </el-button>

  <MobileDialog
    v-model="customConfirmVisible"
    title="敏感操作确认"
    width="500px"
    type="warning"
    @confirm="handleCustomConfirm"
  >
    <div class="custom-confirm">
      <!-- 自定义头部 -->
      <div class="confirm-header">
        <el-icon class="danger-icon"><CircleCloseFilled /></el-icon>
        <h3>此操作具有高风险</h3>
      </div>

      <!-- 确认内容 -->
      <div class="confirm-body">
        <p>您正在执行以下操作：</p>
        <ul class="action-list">
          <li>删除客户的所有订单记录</li>
          <li>清除客户的账户余额</li>
          <li>取消客户的所有会员权益</li>
        </ul>

        <!-- 输入确认框 -->
        <el-form ref="confirmFormRef" :model="confirmForm" :rules="confirmRules">
          <el-form-item prop="confirmText">
            <el-input
              v-model="confirmForm.confirmText"
              placeholder="请输入 'DELETE' 确认操作"
              clearable
            />
          </el-form-item>
        </el-form>

        <!-- 复选框 -->
        <el-checkbox v-model="confirmForm.acknowledged">
          我已了解此操作的后果，并愿意承担相应责任
        </el-checkbox>
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCloseFilled } from '@element-plus/icons-vue'
import MobileDialog from '@/components/MobileDialog.vue'

const customConfirmVisible = ref(false)
const confirmFormRef = ref()

// 确认表单
const confirmForm = reactive({
  confirmText: '',
  acknowledged: false
})

// 验证规则
const confirmRules = {
  confirmText: [
    { required: true, message: '请输入确认文本', trigger: 'blur' },
    { validator: validateConfirmText, trigger: 'blur' }
  ]
}

// 验证确认文本
const validateConfirmText = (rule, value, callback) => {
  if (value !== 'DELETE') {
    callback(new Error('请输入正确的确认文本'))
  } else {
    callback()
  }
}

// 显示自定义确认弹窗
const showCustomConfirm = () => {
  customConfirmVisible.value = true
  confirmForm.confirmText = ''
  confirmForm.acknowledged = false
}

// 处理确认
const handleCustomConfirm = async () => {
  // 验证表单
  const valid = await confirmFormRef.value.validate()
  if (!valid) return

  // 检查复选框
  if (!confirmForm.acknowledged) {
    ElMessage.warning('请确认您已了解操作后果')
    return
  }

  try {
    // 执行危险操作
    await unifiedApi.post('/dangerous-operation', {
      confirmText: confirmForm.confirmText
    })

    ElMessage.success('操作执行成功')
    customConfirmVisible.value = false
  } catch (error) {
    ElMessage.error('操作执行失败')
  }
}
</script>

<style lang="scss" scoped>
.custom-confirm {
  .confirm-header {
    text-align: center;
    margin-bottom: var(--spacing-lg);

    .danger-icon {
      font-size: 48px;
      color: var(--color-danger);
      margin-bottom: var(--spacing-sm);
    }

    h3 {
      margin: 0;
      color: var(--color-danger);
    }
  }

  .confirm-body {
    p {
      margin: var(--spacing-md) 0;
      color: var(--color-text-regular);
    }

    .action-list {
      margin: var(--spacing-md) 0;
      padding-left: var(--spacing-lg);
      color: var(--color-text-regular);

      li {
        margin-bottom: var(--spacing-xs);
        position: relative;

        &::before {
          content: '⚠️';
          position: absolute;
          left: -20px;
        }
      }
    }

    .el-checkbox {
      margin-top: var(--spacing-lg);
    }
  }
}
</style>
```

---

## 详情弹窗

### 1. 数据详情展示

```vue
<!-- views/example/DetailModal.vue -->
<template>
  <el-table :data="tableData">
    <el-table-column label="操作" width="100">
      <template #default="{ row }">
        <el-button link @click="showDetail(row)">查看</el-button>
      </template>
    </el-table-column>
    <!-- 其他列 -->
  </el-table>

  <!-- 详情弹窗 -->
  <MobileDialog
    v-model="detailVisible"
    :title="detailTitle"
    width="800px"
    :show-footer="false"
  >
    <div class="detail-content">
      <!-- 头部信息 -->
      <div class="detail-header">
        <el-descriptions title="基本信息" :column="2" border>
          <el-descriptions-item label="订单编号">
            {{ detailData.orderNo }}
          </el-descriptions-item>
          <el-descriptions-item label="订单状态">
            <el-tag :type="getStatusType(detailData.status)">
              {{ getStatusText(detailData.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="客户名称">
            {{ detailData.customerName }}
          </el-descriptions-item>
          <el-descriptions-item label="下单时间">
            {{ detailData.createTime }}
          </el-descriptions-item>
          <el-descriptions-item label="订单金额">
            <span class="amount">¥{{ detailData.totalAmount }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="支付方式">
            {{ detailData.paymentMethod }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 商品列表 -->
      <div class="detail-section">
        <h4>商品清单</h4>
        <el-table :data="detailData.items" border>
          <el-table-column prop="productName" label="商品名称" />
          <el-table-column prop="price" label="单价" width="100">
            <template #default="{ row }">
              ¥{{ row.price }}
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column label="小计" width="100">
            <template #default="{ row }">
              ¥{{ (row.price * row.quantity).toFixed(2) }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 备注信息 -->
      <div class="detail-section">
        <h4>备注信息</h4>
        <p>{{ detailData.remark || '暂无备注' }}</p>
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'

// 表格数据
const tableData = ref([
  {
    id: 1,
    orderNo: 'SO20251220001',
    customerName: '张三',
    status: 'pending',
    totalAmount: 5999,
    // ... 其他字段
  }
])

// 详情弹窗
const detailVisible = ref(false)
const detailData = ref({})

// 弹窗标题
const detailTitle = computed(() => {
  return detailData.value.orderNo
    ? `订单详情 - ${detailData.value.orderNo}`
    : '订单详情'
})

// 显示详情
const showDetail = async (row) => {
  try {
    // 获取订单详情
    const response = await unifiedApi.get(`/sales/orders/${row.id}`)
    detailData.value = response.data
    detailVisible.value = true
  } catch (error) {
    ElMessage.error('获取详情失败')
  }
}

// 获取状态类型
const getStatusType = (status) => {
  const typeMap = {
    pending: 'warning',
    paid: 'success',
    shipped: 'primary',
    completed: 'success',
    cancelled: 'danger'
  }
  return typeMap[status] || 'info'
}

// 获取状态文本
const getStatusText = (status) => {
  const textMap = {
    pending: '待支付',
    paid: '已支付',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消'
  }
  return textMap[status] || status
}
</script>

<style lang="scss" scoped>
.detail-content {
  .detail-header {
    margin-bottom: var(--spacing-lg);

    .amount {
      font-weight: var(--font-weight-bold);
      color: var(--color-danger);
    }
  }

  .detail-section {
    margin-bottom: var(--spacing-lg);

    h4 {
      margin-bottom: var(--spacing-md);
      color: var(--color-text-primary);
    }

    p {
      margin: 0;
      color: var(--color-text-regular);
      line-height: var(--line-height-normal);
    }
  }
}
</style>
```

### 2. 图片预览弹窗

```vue
<!-- views/example/ImagePreviewModal.vue -->
<template>
  <div class="image-preview-demo">
    <!-- 缩略图列表 -->
    <div class="thumbnail-list">
      <div
        v-for="(image, index) in imageList"
        :key="index"
        class="thumbnail-item"
        @click="showPreview(index)"
      >
        <el-image
          :src="image.thumb"
          fit="cover"
          :preview-src-list="[image.url]"
          :initial-index="index"
          hide-on-click-modal
        />
      </div>
    </div>
  </div>

  <!-- 自定义预览弹窗 -->
  <MobileDialog
    v-model="previewVisible"
    :title="previewTitle"
    width="90%"
    max-width="1200px"
    :fullscreen="isMobile"
    :show-footer="false"
    class="image-preview-dialog"
  >
    <div class="preview-container">
      <!-- 图片展示区 -->
      <div class="image-display">
        <el-image
          :src="currentImage.url"
          fit="contain"
          :zoom-rate="1.2"
          :max-scale="7"
          :min-scale="0.2"
          :preview-src-list="imageUrls"
          :initial-index="currentIndex"
          show-progress
          preview-teleported
        />
      </div>

      <!-- 缩略图导航 -->
      <div class="thumbnail-nav">
        <div
          v-for="(image, index) in imageList"
          :key="index"
          class="nav-item"
          :class="{ active: index === currentIndex }"
          @click="switchImage(index)"
        >
          <el-image :src="image.thumb" fit="cover" />
        </div>
      </div>

      <!-- 图片信息 -->
      <div class="image-info">
        <h4>{{ currentImage.name }}</h4>
        <p>{{ currentImage.description }}</p>
        <div class="image-meta">
          <span>尺寸: {{ currentImage.size }}</span>
          <span>大小: {{ currentImage.fileSize }}</span>
          <span>上传时间: {{ currentImage.uploadTime }}</span>
        </div>
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useResponsive } from '@/composables/useResponsive'
import MobileDialog from '@/components/MobileDialog.vue'

const { isMobile } = useResponsive()

// 图片列表
const imageList = ref([
  {
    name: '产品图片1.jpg',
    url: 'https://example.com/image1.jpg',
    thumb: 'https://example.com/thumb1.jpg',
    description: '产品正面展示',
    size: '1920x1080',
    fileSize: '2.5MB',
    uploadTime: '2025-12-20 10:30'
  },
  {
    name: '产品图片2.jpg',
    url: 'https://example.com/image2.jpg',
    thumb: 'https://example.com/thumb2.jpg',
    description: '产品侧面展示',
    size: '1920x1080',
    fileSize: '2.3MB',
    uploadTime: '2025-12-20 10:31'
  }
])

// 预览弹窗
const previewVisible = ref(false)
const currentIndex = ref(0)

// 当前图片
const currentImage = computed(() => {
  return imageList.value[currentIndex.value] || {}
})

// 图片URL列表
const imageUrls = computed(() => {
  return imageList.value.map(img => img.url)
})

// 弹窗标题
const previewTitle = computed(() => {
  return currentImage.value.name || '图片预览'
})

// 显示预览
const showPreview = (index) => {
  currentIndex.value = index
  previewVisible.value = true
}

// 切换图片
const switchImage = (index) => {
  currentIndex.value = index
}
</script>

<style lang="scss" scoped>
.image-preview-demo {
  .thumbnail-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--spacing-md);

    .thumbnail-item {
      aspect-ratio: 1;
      border-radius: var(--border-radius-md);
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.3s;

      &:hover {
        transform: scale(1.05);
      }

      .el-image {
        width: 100%;
        height: 100%;
      }
    }
  }
}

.image-preview-dialog {
  .preview-container {
    display: flex;
    flex-direction: column;
    height: 70vh;

    @include mobile-only {
      height: 60vh;
    }
  }

  .image-display {
    flex: 1;
    background: var(--color-bg-page);
    border-radius: var(--border-radius-md);
    overflow: hidden;

    .el-image {
      width: 100%;
      height: 100%;
    }
  }

  .thumbnail-nav {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) 0;
    overflow-x: auto;

    &::-webkit-scrollbar {
      display: none;
    }

    .nav-item {
      flex-shrink: 0;
      width: 60px;
      height: 60px;
      border-radius: var(--border-radius-sm);
      overflow: hidden;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.3s;

      &.active {
        border-color: var(--color-primary);
      }

      .el-image {
        width: 100%;
        height: 100%;
      }
    }
  }

  .image-info {
    padding: var(--spacing-md) 0;
    border-top: 1px solid var(--color-border-light);

    h4 {
      margin: 0 0 var(--spacing-xs);
      font-size: var(--font-lg);
    }

    p {
      margin: 0 0 var(--spacing-sm);
      color: var(--color-text-regular);
    }

    .image-meta {
      display: flex;
      gap: var(--spacing-lg);
      font-size: var(--font-sm);
      color: var(--color-text-secondary);

      @include mobile-only {
        flex-direction: column;
        gap: var(--spacing-xs);
      }
    }
  }
}
</style>
```

---

## 多步骤弹窗

### 1. 向导式弹窗

```vue
<!-- views/example/WizardModal.vue -->
<template>
  <el-button type="primary" @click="startWizard">开始配置</el-button>

  <MobileDialog
    v-model="wizardVisible"
    :title="wizardTitle"
    width="700px"
    :show-footer="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <!-- 步骤导航 -->
    <div class="wizard-nav">
      <el-steps :active="currentStep" align-center>
        <el-step
          v-for="(step, index) in steps"
          :key="index"
          :title="step.title"
          :description="step.description"
        />
      </el-steps>
    </div>

    <!-- 步骤内容 -->
    <div class="wizard-content">
      <transition name="fade" mode="out-in">
        <component
          :is="currentStepComponent"
          :key="currentStep"
          v-model="stepData[currentStep]"
          @next="handleNext"
          @prev="handlePrev"
          @finish="handleFinish"
        />
      </transition>
    </div>

    <!-- 步骤进度 -->
    <div class="wizard-progress">
      <div class="progress-info">
        <span>{{ currentStep + 1 }} / {{ steps.length }}</span>
        <el-progress
          :percentage="progressPercentage"
          :show-text="false"
        />
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import MobileDialog from '@/components/MobileDialog.vue'
import Step1Basic from './wizard/Step1Basic.vue'
import Step2Advanced from './wizard/Step2Advanced.vue'
import Step3Confirm from './wizard/Step3Confirm.vue'

const wizardVisible = ref(false)
const currentStep = ref(0)

// 步骤配置
const steps = [
  {
    title: '基础配置',
    description: '设置基本信息',
    component: Step1Basic
  },
  {
    title: '高级配置',
    description: '设置高级选项',
    component: Step2Advanced
  },
  {
    title: '确认配置',
    description: '检查并确认',
    component: Step3Confirm
  }
]

// 步骤数据
const stepData = ref([
  {}, // Step 1 data
  {}, // Step 2 data
  {}  // Step 3 data
])

// 当前步骤组件
const currentStepComponent = computed(() => {
  return steps[currentStep.value].component
})

// 向导标题
const wizardTitle = computed(() => {
  return `配置向导 - ${steps[currentStep.value].title}`
})

// 进度百分比
const progressPercentage = computed(() => {
  return Math.round(((currentStep.value + 1) / steps.length) * 100)
})

// 开始向导
const startWizard = () => {
  currentStep.value = 0
  stepData.value = [{}, {}, {}]
  wizardVisible.value = true
}

// 下一步
const handleNext = () => {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

// 上一步
const handlePrev = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

// 完成配置
const handleFinish = async () => {
  try {
    // 合并所有步骤数据
    const configData = {
      basic: stepData.value[0],
      advanced: stepData.value[1],
      confirm: stepData.value[2]
    }

    // 提交配置
    await unifiedApi.post('/config/save', configData)

    ElMessage.success('配置保存成功')
    wizardVisible.value = false
  } catch (error) {
    ElMessage.error('配置保存失败')
  }
}
</script>

<style lang="scss" scoped>
.wizard-nav {
  margin-bottom: var(--spacing-xl);
}

.wizard-content {
  min-height: 400px;
  margin-bottom: var(--spacing-lg);
}

.wizard-progress {
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);

  .progress-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);

    span {
      min-width: 50px;
      text-align: right;
      color: var(--color-text-secondary);
    }

    .el-progress {
      flex: 1;
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

---

## 全屏弹窗

### 1. 大表单全屏弹窗

```vue
<!-- views/example/FullscreenModal.vue -->
<template>
  <el-button type="primary" @click="showFullscreen">
    全屏编辑
  </el-button>

  <MobileDialog
    v-model="fullscreenVisible"
    title="编辑详情"
    :fullscreen="true"
    :show-close="true"
    class="fullscreen-dialog"
  >
    <div class="fullscreen-content">
      <!-- 固定头部 -->
      <div class="content-header">
        <div class="header-info">
          <h2>{{ documentTitle }}</h2>
          <p>最后编辑: {{ lastEditTime }}</p>
        </div>
        <div class="header-actions">
          <el-button @click="handlePreview">预览</el-button>
          <el-button type="primary" @click="handleSave">保存</el-button>
        </div>
      </div>

      <!-- 可滚动内容区 -->
      <div class="content-body">
        <!-- 左侧编辑区 -->
        <div class="editor-section">
          <div class="section-title">
            <h3>内容编辑</h3>
            <el-button-group size="small">
              <el-button @click="handleFormat">格式化</el-button>
              <el-button @click="handleClear">清空</el-button>
            </el-button-group>
          </div>

          <el-input
            v-model="content"
            type="textarea"
            :rows="20"
            placeholder="请输入内容..."
            class="content-editor"
          />
        </div>

        <!-- 右侧设置区 -->
        <div class="settings-section">
          <div class="section-title">
            <h3>发布设置</h3>
          </div>

          <MobileForm
            v-model="settings"
            :fields="settingFields"
            label-width="100px"
            label-position="top"
          />
        </div>
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import MobileDialog from '@/components/MobileDialog.vue'
import MobileForm from '@/components/MobileForm.vue'
import type { FormField } from '@/types'

const fullscreenVisible = ref(false)

// 文档信息
const documentTitle = ref('未命名文档')
const lastEditTime = ref('2025-12-20 10:30:00')

// 内容
const content = ref('')

// 设置
const settings = ref({
  category: '',
  tags: [],
  status: 'draft',
  publishTime: '',
  allowComment: true
})

// 设置字段
const settingFields: FormField[] = [
  {
    prop: 'category',
    label: '分类',
    type: 'select',
    options: [
      { label: '新闻', value: 'news' },
      { label: '公告', value: 'notice' },
      { label: '帮助', value: 'help' }
    ]
  },
  {
    prop: 'tags',
    label: '标签',
    type: 'select',
    attrs: {
      multiple: true,
      filterable: true,
      allowCreate: true,
      placeholder: '请选择或创建标签'
    }
  },
  {
    prop: 'status',
    label: '状态',
    type: 'radio',
    options: [
      { label: '草稿', value: 'draft' },
      { label: '发布', value: 'published' }
    ]
  },
  {
    prop: 'publishTime',
    label: '发布时间',
    type: 'datetime',
    attrs: {
      placeholder: '选择发布时间'
    }
  },
  {
    prop: 'allowComment',
    label: '允许评论',
    type: 'switch'
  }
]

// 显示全屏弹窗
const showFullscreen = () => {
  fullscreenVisible.value = true
}

// 预览
const handlePreview = () => {
  // 实现预览逻辑
  ElMessage.info('预览功能开发中')
}

// 保存
const handleSave = async () => {
  try {
    const payload = {
      title: documentTitle.value,
      content: content.value,
      settings: settings.value
    }

    await unifiedApi.post('/documents/save', payload)

    ElMessage.success('保存成功')
    lastEditTime.value = new Date().toLocaleString()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

// 格式化
const handleFormat = () => {
  // 实现格式化逻辑
  ElMessage.info('格式化成功')
}

// 清空
const handleClear = () => {
  content.value = ''
  ElMessage.info('内容已清空')
}
</script>

<style lang="scss" scoped>
.fullscreen-dialog {
  :deep(.el-dialog) {
    margin: 0;
    height: 100vh;
    max-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  :deep(.el-dialog__header) {
    padding: 0;
    border-bottom: none;
  }

  :deep(.el-dialog__body) {
    flex: 1;
    padding: 0;
    overflow: hidden;
  }

  :deep(.el-dialog__headerbtn) {
    top: var(--spacing-md);
    right: var(--spacing-md);
    z-index: 100;
  }
}

.fullscreen-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.content-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-white);
  border-bottom: 1px solid var(--color-border-light);

  .header-info {
    h2 {
      margin: 0;
      font-size: var(--font-xl);
    }

    p {
      margin: var(--spacing-xs) 0 0;
      color: var(--color-text-secondary);
      font-size: var(--font-sm);
    }
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-sm);
  }
}

.content-body {
  flex: 1;
  display: flex;
  overflow: hidden;

  @include mobile-only {
    flex-direction: column;
  }
}

.editor-section {
  flex: 2;
  padding: var(--spacing-lg);
  border-right: 1px solid var(--color-border-light);
  overflow-y: auto;

  @include mobile-only {
    border-right: none;
    border-bottom: 1px solid var(--color-border-light);
  }

  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);

    h3 {
      margin: 0;
      font-size: var(--font-lg);
    }
  }

  .content-editor {
    :deep(.el-textarea__inner) {
      font-family: var(--font-family-mono);
      line-height: var(--line-height-relaxed);
    }
  }
}

.settings-section {
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;

  .section-title {
    margin-bottom: var(--spacing-lg);

    h3 {
      margin: 0;
      font-size: var(--font-lg);
    }
  }
}
</style>
```

---

## 自定义弹窗

### 1. 带图表的弹窗

```vue
<!-- views/example/ChartModal.vue -->
<template>
  <el-button @click="showChart">查看统计</el-button>

  <MobileDialog
    v-model="chartVisible"
    title="数据统计"
    width="900px"
    :show-footer="false"
  >
    <div class="chart-container">
      <!-- 统计卡片 -->
      <div class="stats-cards">
        <div
          v-for="stat in statsData"
          :key="stat.label"
          class="stat-card"
        >
          <div class="stat-icon">
            <el-icon><component :is="stat.icon" /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
            <div class="stat-trend" :class="stat.trend">
              <el-icon>
                <ArrowUp v-if="stat.trend === 'up'" />
                <ArrowDown v-if="stat.trend === 'down'" />
              </el-icon>
              {{ stat.change }}
            </div>
          </div>
        </div>
      </div>

      <!-- 图表区域 -->
      <div class="charts-area">
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="chart-item">
              <h4>销售趋势</h4>
              <div ref="trendChartRef" class="chart" />
            </div>
          </el-col>
          <el-col :span="12">
            <div class="chart-item">
              <h4>商品分布</h4>
              <div ref="pieChartRef" class="chart" />
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 数据表格 -->
      <div class="data-table">
        <h4>详细数据</h4>
        <el-table :data="tableData" border>
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column prop="sales" label="销售额" />
          <el-table-column prop="orders" label="订单数" />
          <el-table-column prop="customers" label="客户数" />
        </el-table>
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { ArrowUp, ArrowDown, TrendCharts, PieChart, User, ShoppingCart } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import MobileDialog from '@/components/MobileDialog.vue'

const chartVisible = ref(false)
const trendChartRef = ref()
const pieChartRef = ref()
let trendChart = null
let pieChart = null

// 统计数据
const statsData = [
  {
    label: '总销售额',
    value: '¥128,430',
    icon: TrendCharts,
    trend: 'up',
    change: '+12.5%'
  },
  {
    label: '订单数量',
    value: '1,234',
    icon: ShoppingCart,
    trend: 'up',
    change: '+8.3%'
  },
  {
    label: '客户总数',
    value: '5,678',
    icon: User,
    trend: 'down',
    change: '-2.1%'
  },
  {
    label: '转化率',
    value: '3.45%',
    icon: PieChart,
    trend: 'up',
    change: '+0.5%'
  }
]

// 表格数据
const tableData = [
  { date: '2025-12-20', sales: 12345, orders: 123, customers: 89 },
  { date: '2025-12-19', sales: 10987, orders: 109, customers: 76 },
  { date: '2025-12-18', sales: 13456, orders: 134, customers: 98 }
]

// 显示图表
const showChart = async () => {
  chartVisible.value = true

  await nextTick()
  initCharts()
}

// 初始化图表
const initCharts = () => {
  // 趋势图
  if (trendChartRef.value) {
    trendChart = echarts.init(trendChartRef.value)

    const trendOption = {
      title: {
        text: '最近7天销售趋势'
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
      },
      yAxis: {
        type: 'value'
      },
      series: [{
        data: [12000, 15000, 13000, 17000, 16000, 19000, 21000],
        type: 'line',
        smooth: true,
        areaStyle: {
          opacity: 0.3
        }
      }]
    }

    trendChart.setOption(trendOption)
  }

  // 饼图
  if (pieChartRef.value) {
    pieChart = echarts.init(pieChartRef.value)

    const pieOption = {
      title: {
        text: '商品类别占比'
      },
      tooltip: {
        trigger: 'item'
      },
      series: [{
        type: 'pie',
        radius: '60%',
        data: [
          { value: 35, name: '手机' },
          { value: 25, name: '配件' },
          { value: 20, name: '维修' },
          { value: 20, name: '其他' }
        ]
      }]
    }

    pieChart.setOption(pieOption)
  }

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
}

// 处理窗口大小变化
const handleResize = () => {
  trendChart?.resize()
  pieChart?.resize()
}

// 组件卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  pieChart?.dispose()
})
</script>

<style lang="scss" scoped>
.chart-container {
  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);

    .stat-card {
      display: flex;
      align-items: center;
      padding: var(--spacing-md);
      background: var(--color-bg-white);
      border: 1px solid var(--color-border-light);
      border-radius: var(--border-radius-md);
      transition: all 0.3s;

      &:hover {
        box-shadow: var(--shadow-md);
      }

      .stat-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-primary-light-9);
        border-radius: var(--border-radius-md);
        margin-right: var(--spacing-md);

        .el-icon {
          font-size: 24px;
          color: var(--color-primary);
        }
      }

      .stat-content {
        flex: 1;

        .stat-value {
          font-size: var(--font-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          margin-bottom: var(--spacing-xs);
        }

        .stat-label {
          font-size: var(--font-sm);
          color: var(--color-text-secondary);
          margin-bottom: var(--spacing-xs);
        }

        .stat-trend {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: var(--font-sm);

          &.up {
            color: var(--color-success);
          }

          &.down {
            color: var(--color-danger);
          }

          .el-icon {
            font-size: 12px;
          }
        }
      }
    }
  }

  .charts-area {
    margin-bottom: var(--spacing-xl);

    .chart-item {
      background: var(--color-bg-white);
      border: 1px solid var(--color-border-light);
      border-radius: var(--border-radius-md);
      padding: var(--spacing-md);

      h4 {
        margin: 0 0 var(--spacing-md);
        font-size: var(--font-lg);
      }

      .chart {
        height: 300px;
      }
    }
  }

  .data-table {
    h4 {
      margin: 0 0 var(--spacing-md);
      font-size: var(--font-lg);
    }
  }
}

// 移动端适配
@include mobile-only {
  .chart-container {
    .stats-cards {
      grid-template-columns: 1fr;
    }

    .charts-area {
      .el-col {
        width: 100% !important;
        margin-bottom: var(--spacing-md);
      }
    }

    .chart-item .chart {
      height: 250px;
    }
  }
}
</style>
```

---

## 最佳实践

### 1. 性能优化

- **懒加载**：大型弹窗内容使用懒加载
- **销毁组件**：关闭弹窗时销毁不需要的组件
- **防抖节流**：搜索输入使用防抖处理

### 2. 用户体验

- **加载状态**：适当显示 loading 状态
- **错误处理**：友好的错误提示
- **确认提示**：危险操作需要二次确认

### 3. 移动端适配

- **触摸优化**：按钮最小尺寸 44px
- **滑动手势**：支持滑动关闭
- **全屏模式**：小屏幕自动全屏

### 4. 代码组织

- **组件拆分**：复杂弹窗拆分为多个子组件
- **状态管理**：使用 Pinia 管理弹窗状态
- **逻辑复用**：使用 composables 复用逻辑

---

**更新日期**：2025-12-20
**版本**：v2.0.0
**维护者**：TF2025 前端开发团队