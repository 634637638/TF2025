# TF2025 组件使用示例

> **文档说明**：提供 TF2025 项目中标准组件的实际使用示例，展示最佳实践和常见模式
>
> **最后更新**：2025-12-20
> **版本**：v2.0.0
> **维护者**：TF2025 开发团队

## 📝 目录结构

```
docs/examples/
├── modal-examples.md          # 弹窗组件示例
├── table-examples.md          # 表格组件示例
├── form-examples.md           # 表单组件示例
├── layout-examples.md         # 布局组件示例
├── navigation-examples.md     # 导航组件示例
└── component-patterns.md      # 组件组合模式
```

## 🎯 快速索引

- [基础弹窗使用](modal-examples.md#基础弹窗使用)
- [表单弹窗组合](modal-examples.md#表单弹窗组合)
- [移动端表格](table-examples.md#移动端卡片布局)
- [响应式表单](form-examples.md#响应式表单布局)
- [页面布局模式](layout-examples.md#标准页面布局)

---

## 模态框组件示例 (Modal Examples)

### 基础弹窗使用

#### 1. 简单确认弹窗

```vue
<!-- views/example/SimpleConfirmation.vue -->
<template>
  <el-button type="primary" @click="handleConfirm">
    删除记录
  </el-button>

  <!-- 使用 MobileDialog 进行确认 -->
  <MobileDialog
    v-model="confirmVisible"
    title="确认删除"
    width="400px"
    @confirm="handleDelete"
  >
    <div class="confirm-content">
      <el-icon class="warning-icon"><WarningFilled /></el-icon>
      <p>确定要删除这条记录吗？此操作不可恢复。</p>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import MobileDialog from '@/components/MobileDialog.vue'

const confirmVisible = ref(false)

const handleConfirm = () => {
  confirmVisible.value = true
}

const handleDelete = async () => {
  try {
    // 调用删除 API
    await unifiedApi.delete(`/records/${recordId}`)

    ElMessage.success('删除成功')
    confirmVisible.value = false

    // 刷新列表
    await fetchList()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}
</script>

<style lang="scss" scoped>
.confirm-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) 0;

  .warning-icon {
    font-size: 24px;
    color: var(--color-warning);
    flex-shrink: 0;
  }

  p {
    margin: 0;
    color: var(--color-text-regular);
    line-height: var(--line-height-normal);
  }
}
</style>
```

#### 2. 表单弹窗组合

```vue
<!-- views/example/UserFormDialog.vue -->
<template>
  <el-button type="primary" @click="handleCreate">
    新建用户
  </el-button>

  <!-- 使用 MobileDialog 包装 MobileForm -->
  <MobileDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑用户' : '新建用户'"
    :width="800"
    :loading="formLoading"
    @confirm="handleSubmit"
    @cancel="handleCancel"
  >
    <MobileForm
      ref="formRef"
      v-model="formData"
      :fields="formFields"
      :rules="formRules"
      :loading="formLoading"
      :label-width="120"
      @submit="handleSubmit"
    />
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { unifiedApi } from '@/services/unified-api'
import MobileDialog from '@/components/MobileDialog.vue'
import MobileForm from '@/components/MobileForm.vue'
import type { FormField, FormRule } from '@/types'

// 弹窗状态
const dialogVisible = ref(false)
const formLoading = ref(false)
const isEdit = ref(false)
const currentId = ref<number | null>(null)

// 表单引用
const formRef = ref()

// 表单数据
const formData = ref({
  username: '',
  email: '',
  role: '',
  department: '',
  status: 'active'
})

// 表单字段定义
const formFields: FormField[] = [
  {
    prop: 'username',
    label: '用户名',
    type: 'input',
    required: true,
    attrs: {
      placeholder: '请输入用户名',
      clearable: true
    }
  },
  {
    prop: 'email',
    label: '邮箱',
    type: 'input',
    required: true,
    attrs: {
      type: 'email',
      placeholder: '请输入邮箱地址',
      clearable: true
    }
  },
  {
    prop: 'role',
    label: '角色',
    type: 'select',
    required: true,
    options: [
      { label: '管理员', value: 'admin' },
      { label: '销售员', value: 'sales' },
      { label: '仓管员', value: 'warehouse' }
    ]
  },
  {
    prop: 'department',
    label: '部门',
    type: 'select',
    required: true,
    options: [
      { label: '销售部', value: 'sales' },
      { label: '采购部', value: 'procurement' },
      { label: '仓储部', value: 'warehouse' }
    ]
  },
  {
    prop: 'status',
    label: '状态',
    type: 'radio',
    options: [
      { label: '启用', value: 'active' },
      { label: '禁用', value: 'inactive' }
    ]
  }
]

// 表单验证规则
const formRules: FormRule = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度为 3-20 个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  role: [
    { required: true, message: '请选择角色', trigger: 'change' }
  ],
  department: [
    { required: true, message: '请选择部门', trigger: 'change' }
  ]
}

// 打开弹窗
const openDialog = (row?: any) => {
  dialogVisible.value = true
  isEdit.value = !!row

  if (row) {
    // 编辑模式，填充数据
    currentId.value = row.id
    formData.value = { ...row }
  } else {
    // 新建模式，重置表单
    currentId.value = null
    formData.value = {
      username: '',
      email: '',
      role: '',
      department: '',
      status: 'active'
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  // 验证表单
  const valid = await formRef.value.validate()
  if (!valid) return

  formLoading.value = true

  try {
    if (isEdit.value) {
      // 更新用户
      await unifiedApi.put(`/users/${currentId.value}`, formData.value)
      ElMessage.success('更新成功')
    } else {
      // 创建用户
      await unifiedApi.post('/users', formData.value)
      ElMessage.success('创建成功')
    }

    dialogVisible.value = false
    // 刷新列表
    await fetchList()
  } catch (error) {
    ElMessage.error(isEdit.value ? '更新失败' : '创建失败')
  } finally {
    formLoading.value = false
  }
}

// 取消操作
const handleCancel = () => {
  dialogVisible.value = false
}

// 获取列表数据
const fetchList = async () => {
  // 实现获取列表逻辑
}

// 暴露方法给父组件
defineExpose({
  openDialog
})
</script>
```

#### 3. 复杂业务弹窗

```vue
<!-- views/example/SalesOrderDialog.vue -->
<template>
  <MobileDialog
    v-model="visible"
    :title="orderTitle"
    width="90%"
    max-width="1200px"
    :fullscreen="isMobile"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <!-- 自定义工具栏 -->
    <template #header>
      <div class="dialog-header">
        <h3>{{ orderTitle }}</h3>
        <div class="header-actions">
          <el-button
            v-permission="'sales_salesview:export'"
            size="small"
            @click="handleExport"
          >
            导出
          </el-button>
          <el-button
            size="small"
            @click="handlePrint"
          >
            打印
          </el-button>
        </div>
      </div>
    </template>

    <!-- 步骤指示器 -->
    <el-steps :active="currentStep" align-center class="order-steps">
      <el-step title="选择客户" />
      <el-step title="选择商品" />
      <el-step title="确认订单" />
    </el-steps>

    <!-- 步骤内容 -->
    <div class="step-content">
      <!-- 步骤1：选择客户 -->
      <div v-show="currentStep === 0" class="step-customer">
        <MobileForm
          ref="customerFormRef"
          v-model="orderData.customer"
          :fields="customerFields"
          :rules="customerRules"
        />
      </div>

      <!-- 步骤2：选择商品 -->
      <div v-show="currentStep === 1" class="step-products">
        <ProductSelector
          v-model="orderData.items"
          :warehouse-id="orderData.customer.warehouse_id"
          @change="handleProductChange"
        />
      </div>

      <!-- 步骤3：确认订单 -->
      <div v-show="currentStep === 2" class="step-summary">
        <OrderSummary
          :customer="orderData.customer"
          :items="orderData.items"
          :total="orderTotal"
        />
      </div>
    </div>

    <!-- 自定义底部 -->
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
          @click="handleConfirm"
        >
          提交订单
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import MobileDialog from '@/components/MobileDialog.vue'
import MobileForm from '@/components/MobileForm.vue'
import ProductSelector from './ProductSelector.vue'
import OrderSummary from './OrderSummary.vue'

const props = defineProps<{
  modelValue: boolean
  orderId?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': []
}>()

const router = useRouter()
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 步骤控制
const currentStep = ref(0)
const submitting = ref(false)

// 订单数据
const orderData = ref({
  customer: {
    id: null,
    name: '',
    warehouse_id: null
  },
  items: [],
  discount: 0,
  payment_method: 'cash'
})

// 订单标题
const orderTitle = computed(() => {
  return props.orderId ? '编辑销售订单' : '新建销售订单'
})

// 订单总金额
const orderTotal = computed(() => {
  return orderData.value.items.reduce((total, item) => {
    return total + (item.price * item.quantity)
  }, 0)
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
      remote: true,
      clearable: true
    }
  },
  {
    prop: 'warehouse_id',
    label: '仓库',
    type: 'select',
    required: true,
    attrs: {
      placeholder: '请选择仓库'
    }
  }
]

// 步骤控制方法
const handleNext = async () => {
  if (currentStep.value === 0) {
    // 验证客户信息
    const valid = await validateCustomer()
    if (!valid) return
  } else if (currentStep.value === 1) {
    // 验证商品信息
    if (orderData.value.items.length === 0) {
      ElMessage.warning('请至少选择一个商品')
      return
    }
  }

  currentStep.value++
}

const handlePrev = () => {
  currentStep.value--
}

// 提交订单
const handleConfirm = async () => {
  submitting.value = true

  try {
    const orderPayload = {
      customer_id: orderData.value.customer.id,
      warehouse_id: orderData.value.customer.warehouse_id,
      items: orderData.value.items,
      total_amount: orderTotal.value,
      discount: orderData.value.discount,
      payment_method: orderData.value.payment_method
    }

    if (props.orderId) {
      await unifiedApi.put(`/sales/orders/${props.orderId}`, orderPayload)
    } else {
      await unifiedApi.post('/sales/orders', orderPayload)
    }

    ElMessage.success('订单提交成功')
    visible.value = false
    emit('success')

    // 跳转到订单详情页
    router.push(`/sales/orders/${props.orderId || 'new'}`)
  } catch (error) {
    ElMessage.error('订单提交失败')
  } finally {
    submitting.value = false
  }
}

// 其他方法
const handleCancel = () => {
  visible.value = false
  currentStep.value = 0
}

const handleExport = () => {
  // 导出逻辑
}

const handlePrint = () => {
  // 打印逻辑
}

// 监听弹窗关闭
watch(visible, (val) => {
  if (!val) {
    // 重置状态
    currentStep.value = 0
    orderData.value = {
      customer: { id: null, name: '', warehouse_id: null },
      items: [],
      discount: 0,
      payment_method: 'cash'
    }
  }
})
</script>

<style lang="scss" scoped>
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    font-size: var(--font-lg);
    color: var(--color-text-primary);
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-sm);
  }
}

.order-steps {
  margin: var(--spacing-lg) 0;

  @include mobile-only {
    :deep(.el-step__title) {
      font-size: var(--font-sm);
    }
  }
}

.step-content {
  min-height: 400px;
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

## 表格组件示例 (Table Examples)

### 移动端卡片布局

```vue
<!-- views/example/MobileUserList.vue -->
<template>
  <ResponsiveLayout :title="pageTitle" :breadcrumb="breadcrumb">
    <template #actions>
      <el-button
        v-permission="'users_usersview:create'"
        type="primary"
        @click="handleCreate"
      >
        新建用户
      </el-button>
    </template>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="用户名/邮箱"
            clearable
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          >
            <template #append>
              <el-button @click="handleSearch">
                <el-icon><Search /></el-icon>
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="searchForm.status"
            placeholder="全部"
            clearable
            @change="handleSearch"
          >
            <el-option label="启用" value="active" />
            <el-option label="禁用" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <!-- 移动端表格组件 -->
    <MobileTable
      :data="tableData"
      :columns="tableColumns"
      :actions="tableActions"
      :loading="loading"
      :pagination="pagination"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @action="handleAction"
    />

    <!-- 用户表单弹窗 -->
    <UserFormDialog ref="userFormRef" @success="fetchData" />
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import ResponsiveLayout from '@/components/ResponsiveLayout.vue'
import MobileTable from '@/components/MobileTable.vue'
import UserFormDialog from './UserFormDialog.vue'

// 页面配置
const pageTitle = '用户管理'
const breadcrumb = [
  { label: '首页', path: '/' },
  { label: '系统管理', path: '/system' },
  { label: '用户管理' }
]

// 数据状态
const loading = ref(false)
const tableData = ref([])

// 搜索表单
const searchForm = ref({
  keyword: '',
  status: ''
})

// 分页配置
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

// 表格列定义
const tableColumns = [
  {
    prop: 'avatar',
    label: '头像',
    type: 'image',
    width: 60,
    attrs: {
      fit: 'cover',
      circle: true
    }
  },
  {
    prop: 'username',
    label: '用户名',
    sortable: true,
    minWidth: 120
  },
  {
    prop: 'email',
    label: '邮箱',
    minWidth: 180
  },
  {
    prop: 'role',
    label: '角色',
    width: 100,
    formatter: (row) => {
      const roleMap = {
        admin: '管理员',
        sales: '销售员',
        warehouse: '仓管员'
      }
      return roleMap[row.role] || row.role
    }
  },
  {
    prop: 'department',
    label: '部门',
    width: 100
  },
  {
    prop: 'status',
    label: '状态',
    width: 80,
    type: 'tag',
    attrs: (row) => ({
      type: row.status === 'active' ? 'success' : 'danger'
    }),
    formatter: (row) => {
      return row.status === 'active' ? '启用' : '禁用'
    }
  },
  {
    prop: 'last_login',
    label: '最后登录',
    width: 160,
    sortable: true
  }
]

// 表格操作按钮
const tableActions = [
  {
    label: '查看',
    icon: 'View',
    type: 'primary',
    permission: 'users_usersview:view',
    handler: (row) => handleView(row)
  },
  {
    label: '编辑',
    icon: 'Edit',
    type: 'warning',
    permission: 'users_usersview:edit',
    handler: (row) => handleEdit(row)
  },
  {
    label: '删除',
    icon: 'Delete',
    type: 'danger',
    permission: 'users_usersview:delete',
    confirm: {
      title: '确认删除',
      message: '确定要删除这个用户吗？'
    },
    handler: (row) => handleDelete(row)
  },
  {
    label: '重置密码',
    icon: 'Key',
    type: 'info',
    permission: 'users_usersview:reset_password',
    handler: (row) => handleResetPassword(row)
  }
]

// 表单引用
const userFormRef = ref()

// 获取数据
const fetchData = async () => {
  loading.value = true

  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      ...searchForm.value
    }

    const response = await unifiedApi.get('/users', { params })

    tableData.value = response.data.data
    pagination.value.total = response.data.pagination.total
  } catch (error) {
    ElMessage.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

// 搜索处理
const handleSearch = () => {
  pagination.value.page = 1
  fetchData()
}

// 分页处理
const handlePageChange = (page) => {
  pagination.value.page = page
  fetchData()
}

const handleSizeChange = (pageSize) => {
  pagination.value.pageSize = pageSize
  pagination.value.page = 1
  fetchData()
}

// 表格操作处理
const handleAction = (action, row) => {
  action.handler(row)
}

// 新建用户
const handleCreate = () => {
  userFormRef.value.openDialog()
}

// 查看用户
const handleView = (row) => {
  router.push(`/system/users/${row.id}`)
}

// 编辑用户
const handleEdit = (row) => {
  userFormRef.value.openDialog(row)
}

// 删除用户
const handleDelete = async (row) => {
  try {
    await unifiedApi.delete(`/users/${row.id}`)
    ElMessage.success('删除成功')
    await fetchData()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

// 重置密码
const handleResetPassword = async (row) => {
  try {
    await unifiedApi.post(`/users/${row.id}/reset-password`)
    ElMessage.success('密码重置成功，新密码已发送到用户邮箱')
  } catch (error) {
    ElMessage.error('密码重置失败')
  }
}

// 初始化
onMounted(() => {
  fetchData()
})
</script>

<style lang="scss" scoped>
.search-bar {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-bg-white);
  border-radius: var(--border-radius-md);

  .el-form {
    margin: 0;

    @include mobile-only {
      .el-form-item {
        display: block;
        margin-bottom: var(--spacing-sm);

        &:last-child {
          margin-bottom: 0;
        }
      }

      .el-input,
      .el-select {
        width: 100%;
      }
    }
  }
}
</style>
```

### 高级表格功能

```vue
<!-- views/example/AdvancedProductTable.vue -->
<template>
  <div class="advanced-table">
    <!-- 工具栏 -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <el-button-group>
          <el-button
            :type="viewMode === 'table' ? 'primary' : ''"
            @click="viewMode = 'table'"
          >
            <el-icon><Grid /></el-icon>
            表格视图
          </el-button>
          <el-button
            :type="viewMode === 'card' ? 'primary' : ''"
            @click="viewMode = 'card'"
          >
            <el-icon><List /></el-icon>
            卡片视图
          </el-button>
        </el-button-group>
      </div>

      <div class="toolbar-right">
        <el-tooltip content="刷新">
          <el-button :icon="Refresh" @click="handleRefresh" />
        </el-tooltip>

        <el-tooltip content="密度">
          <el-button :icon="Operation" @click="handleDensity" />
        </el-tooltip>

        <el-tooltip content="列设置">
          <el-button :icon="Setting" @click="showColumnSetting = true" />
        </el-tooltip>

        <el-dropdown @command="handleExport">
          <el-button :icon="Download">
            导出<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="csv">导出 CSV</el-dropdown-item>
              <el-dropdown-item command="excel">导出 Excel</el-dropdown-item>
              <el-dropdown-item command="pdf">导出 PDF</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 多选操作栏 -->
    <div v-if="selectedRows.length > 0" class="selection-bar">
      <span>已选择 {{ selectedRows.length }} 项</span>
      <el-button-group>
        <el-button size="small" @click="handleBatchEdit">批量编辑</el-button>
        <el-button size="small" @click="handleBatchDelete">批量删除</el-button>
        <el-button size="small" @click="clearSelection">清空选择</el-button>
      </el-button-group>
    </div>

    <!-- 表格视图 -->
    <MobileTable
      v-if="viewMode === 'table'"
      ref="tableRef"
      :data="tableData"
      :columns="visibleColumns"
      :actions="tableActions"
      :loading="loading"
      :pagination="pagination"
      :row-key="rowKey"
      :stripe="stripe"
      :border="border"
      :size="tableSize"
      selection
      @selection-change="handleSelectionChange"
      @sort-change="handleSortChange"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @action="handleAction"
    />

    <!-- 卡片视图 -->
    <div v-else class="card-view">
      <el-row :gutter="16">
        <el-col
          v-for="item in tableData"
          :key="item.id"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
        >
          <ProductCard
            :data="item"
            :actions="cardActions"
            @action="handleAction"
          />
        </el-col>
      </el-row>
    </div>

    <!-- 列设置弹窗 -->
    <ColumnSetting
      v-model="showColumnSetting"
      :columns="allColumns"
      :value="selectedColumns"
      @change="handleColumnChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Grid,
  List,
  Refresh,
  Operation,
  Setting,
  Download,
  ArrowDown
} from '@element-plus/icons-vue'
import MobileTable from '@/components/MobileTable.vue'
import ProductCard from './ProductCard.vue'
import ColumnSetting from './ColumnSetting.vue'

// 视图模式
const viewMode = ref('table')

// 表格配置
const tableSize = ref('default')
const stripe = ref(true)
const border = ref(true)

// 列配置
const showColumnSetting = ref(false)
const allColumns = ref([
  { prop: 'image', label: '图片', type: 'image', width: 80, fixed: 'left' },
  { prop: 'name', label: '商品名称', minWidth: 150, sortable: true },
  { prop: 'category', label: '分类', width: 100 },
  { prop: 'brand', label: '品牌', width: 100 },
  { prop: 'model', label: '型号', width: 120 },
  { prop: 'color', label: '颜色', width: 80 },
  { prop: 'storage', label: '存储', width: 80 },
  { prop: 'price', label: '价格', width: 100, sortable: true },
  { prop: 'stock', label: '库存', width: 80 },
  { prop: 'status', label: '状态', width: 80, type: 'tag' }
])

const selectedColumns = ref(allColumns.value.map(col => col.prop))
const visibleColumns = computed(() => {
  return allColumns.value.filter(col => selectedColumns.value.includes(col.prop))
})

// 数据状态
const loading = ref(false)
const tableData = ref([])
const selectedRows = ref([])
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

// 表格操作
const tableActions = [
  { label: '查看', icon: 'View', handler: handleView },
  { label: '编辑', icon: 'Edit', handler: handleEdit },
  { label: '删除', icon: 'Delete', type: 'danger', handler: handleDelete }
]

// 卡片操作
const cardActions = [
  { label: '详情', icon: 'View', handler: handleView },
  { label: '编辑', icon: 'Edit', handler: handleEdit },
  { label: '删除', icon: 'Delete', type: 'danger', handler: handleDelete }
]

// 表格引用
const tableRef = ref()

// 行键
const rowKey = (row) => row.id

// 获取数据
const fetchData = async () => {
  loading.value = true
  try {
    const response = await unifiedApi.get('/products', {
      params: {
        page: pagination.value.page,
        pageSize: pagination.value.pageSize
      }
    })
    tableData.value = response.data.data
    pagination.value.total = response.data.pagination.total
  } catch (error) {
    ElMessage.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

// 处理选择变化
const handleSelectionChange = (selection) => {
  selectedRows.value = selection
}

// 处理排序
const handleSortChange = ({ prop, order }) => {
  // 实现排序逻辑
  fetchData()
}

// 刷新
const handleRefresh = () => {
  fetchData()
}

// 密度切换
const handleDensity = () => {
  const sizes = ['large', 'default', 'small']
  const currentIndex = sizes.indexOf(tableSize.value)
  tableSize.value = sizes[(currentIndex + 1) % sizes.length]
}

// 导出
const handleExport = (format) => {
  // 实现导出逻辑
}

// 批量操作
const handleBatchEdit = () => {
  // 批量编辑
}

const handleBatchDelete = () => {
  // 批量删除
}

const clearSelection = () => {
  tableRef.value?.clearSelection()
}

// 列设置
const handleColumnChange = (columns) => {
  selectedColumns.value = columns
}

// 其他方法
const handleView = (row) => {
  router.push(`/products/${row.id}`)
}

const handleEdit = (row) => {
  // 编辑逻辑
}

const handleDelete = (row) => {
  // 删除逻辑
}

const handleAction = (action, row) => {
  action.handler(row)
}

const handlePageChange = (page) => {
  pagination.value.page = page
  fetchData()
}

const handleSizeChange = (pageSize) => {
  pagination.value.pageSize = pageSize
  fetchData()
}

onMounted(() => {
  fetchData()
})
</script>

<style lang="scss" scoped>
.advanced-table {
  .table-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);

    @include mobile-only {
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .toolbar-left,
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }
  }

  .selection-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-md);
    background: var(--color-primary-light-9);
    border: 1px solid var(--color-primary-light-7);
    border-radius: var(--border-radius-sm);

    @include mobile-only {
      flex-direction: column;
      gap: var(--spacing-sm);
      text-align: center;
    }
  }

  .card-view {
    padding: var(--spacing-md);
  }
}
</style>
```

---

## 表单组件示例 (Form Examples)

### 响应式表单布局

```vue
<!-- views/example/ResponsiveForm.vue -->
<template>
  <ResponsiveLayout :title="pageTitle" :breadcrumb="breadcrumb">
    <div class="form-container">
      <!-- 表单步骤 -->
      <el-steps :active="currentStep" align-center class="form-steps">
        <el-step title="基本信息" />
        <el-step title="详细信息" />
        <el-step title="其他信息" />
      </el-steps>

      <!-- 表单内容 -->
      <MobileForm
        ref="formRef"
        v-model="formData"
        :fields="currentFields"
        :rules="formRules"
        :label-width="labelWidth"
        :label-position="labelPosition"
        :size="formSize"
        :loading="loading"
        class="product-form"
        @submit="handleSubmit"
      />

      <!-- 表单操作 -->
      <div class="form-actions">
        <el-button @click="handleCancel">取消</el-button>
        <el-button
          v-if="currentStep > 0"
          @click="handlePrev"
        >
          上一步
        </el-button>
        <el-button
          v-if="currentStep < steps.length - 1"
          type="primary"
          @click="handleNext"
        >
          下一步
        </el-button>
        <el-button
          v-if="currentStep === steps.length - 1"
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          提交
        </el-button>
      </div>
    </div>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ResponsiveLayout from '@/components/ResponsiveLayout.vue'
import MobileForm from '@/components/MobileForm.vue'
import { unifiedApi } from '@/services/unified-api'
import type { FormField } from '@/types'

const route = useRoute()
const router = useRouter()

// 页面配置
const pageTitle = computed(() => {
  return isEdit.value ? '编辑商品' : '新建商品'
})

const breadcrumb = [
  { label: '首页', path: '/' },
  { label: '商品管理', path: '/products' },
  { label: pageTitle.value }
]

// 表单状态
const isEdit = ref(!!route.params.id)
const currentStep = ref(0)
const loading = ref(false)
const submitting = ref(false)
const formRef = ref()

// 步骤配置
const steps = ['basic', 'detail', 'other']

// 响应式配置
const { isMobile } = useResponsive()
const labelWidth = computed(() => isMobile.value ? '80px' : '120px')
const labelPosition = computed(() => isMobile.value ? 'top' : 'right')
const formSize = computed(() => isMobile.value ? 'large' : 'default')

// 表单数据
const formData = ref({
  // 基本信息
  name: '',
  category_id: null,
  brand_id: null,
  model: '',

  // 详细信息
  color: '',
  storage: '',
  price: 0,
  cost_price: 0,
  description: '',

  // 其他信息
  tags: [],
  images: [],
  status: 'active'
})

// 所有表单字段
const allFields: Record<string, FormField[]> = {
  basic: [
    {
      prop: 'name',
      label: '商品名称',
      type: 'input',
      required: true,
      span: 24,
      attrs: {
        placeholder: '请输入商品名称',
        maxlength: 100,
        showWordLimit: true
      }
    },
    {
      prop: 'category_id',
      label: '商品分类',
      type: 'select',
      required: true,
      span: isMobile.value ? 24 : 12,
      options: [],
      attrs: {
        placeholder: '请选择分类',
        filterable: true,
        clearable: true
      }
    },
    {
      prop: 'brand_id',
      label: '商品品牌',
      type: 'select',
      required: true,
      span: isMobile.value ? 24 : 12,
      options: [],
      attrs: {
        placeholder: '请选择品牌',
        filterable: true,
        clearable: true
      }
    },
    {
      prop: 'model',
      label: '商品型号',
      type: 'input',
      span: 24,
      attrs: {
        placeholder: '请输入商品型号'
      }
    }
  ],

  detail: [
    {
      prop: 'color',
      label: '颜色',
      type: 'select',
      span: isMobile.value ? 24 : 8,
      options: [
        { label: '黑色', value: 'black' },
        { label: '白色', value: 'white' },
        { label: '红色', value: 'red' },
        { label: '蓝色', value: 'blue' }
      ]
    },
    {
      prop: 'storage',
      label: '存储容量',
      type: 'select',
      span: isMobile.value ? 24 : 8,
      options: [
        { label: '64GB', value: '64' },
        { label: '128GB', value: '128' },
        { label: '256GB', value: '256' },
        { label: '512GB', value: '512' }
      ]
    },
    {
      prop: 'status',
      label: '状态',
      type: 'radio',
      span: isMobile.value ? 24 : 8,
      options: [
        { label: '上架', value: 'active' },
        { label: '下架', value: 'inactive' }
      ]
    },
    {
      prop: 'price',
      label: '销售价格',
      type: 'number',
      required: true,
      span: isMobile.value ? 24 : 12,
      attrs: {
        placeholder: '请输入销售价格',
        min: 0,
        precision: 2
      }
    },
    {
      prop: 'cost_price',
      label: '成本价格',
      type: 'number',
      span: isMobile.value ? 24 : 12,
      attrs: {
        placeholder: '请输入成本价格',
        min: 0,
        precision: 2
      }
    },
    {
      prop: 'description',
      label: '商品描述',
      type: 'textarea',
      span: 24,
      attrs: {
        placeholder: '请输入商品描述',
        rows: 4,
        maxlength: 500,
        showWordLimit: true
      }
    }
  ],

  other: [
    {
      prop: 'tags',
      label: '商品标签',
      type: 'select',
      span: 24,
      attrs: {
        multiple: true,
        filterable: true,
        allowCreate: true,
        placeholder: '请选择或输入标签'
      }
    },
    {
      prop: 'images',
      label: '商品图片',
      type: 'upload',
      span: 24,
      attrs: {
        action: '/api/upload',
        listType: 'picture-card',
        limit: 5,
        accept: 'image/*'
      }
    }
  ]
}

// 当前步骤的字段
const currentFields = computed(() => {
  return allFields[steps[currentStep.value]] || []
})

// 表单验证规则
const formRules = computed(() => {
  const rules = {
    name: [
      { required: true, message: '请输入商品名称', trigger: 'blur' },
      { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
    ],
    category_id: [
      { required: true, message: '请选择商品分类', trigger: 'change' }
    ],
    brand_id: [
      { required: true, message: '请选择商品品牌', trigger: 'change' }
    ],
    price: [
      { required: true, message: '请输入销售价格', trigger: 'blur' },
      { type: 'number', min: 0, message: '价格必须大于0', trigger: 'blur' }
    ]
  }

  return rules
})

// 获取分类和品牌数据
const fetchOptions = async () => {
  try {
    const [categoriesRes, brandsRes] = await Promise.all([
      unifiedApi.get('/categories'),
      unifiedApi.get('/brands')
    ])

    allFields.basic[1].options = categoriesRes.data.map((cat: any) => ({
      label: cat.name,
      value: cat.id
    }))

    allFields.basic[2].options = brandsRes.data.map((brand: any) => ({
      label: brand.name,
      value: brand.id
    }))
  } catch (error) {
    ElMessage.error('获取选项数据失败')
  }
}

// 获取商品详情（编辑模式）
const fetchProduct = async () => {
  if (!isEdit.value) return

  loading.value = true
  try {
    const response = await unifiedApi.get(`/products/${route.params.id}`)
    formData.value = { ...response.data }
  } catch (error) {
    ElMessage.error('获取商品信息失败')
  } finally {
    loading.value = false
  }
}

// 步骤控制
const handleNext = async () => {
  if (!formRef.value) return

  // 验证当前步骤
  const valid = await formRef.value.validate()
  if (!valid) return

  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

const handlePrev = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  const valid = await formRef.value.validate()
  if (!valid) return

  submitting.value = true

  try {
    const payload = { ...formData.value }

    if (isEdit.value) {
      await unifiedApi.put(`/products/${route.params.id}`, payload)
      ElMessage.success('更新成功')
    } else {
      await unifiedApi.post('/products', payload)
      ElMessage.success('创建成功')
    }

    // 跳转到列表页
    router.push('/products')
  } catch (error) {
    ElMessage.error(isEdit.value ? '更新失败' : '创建失败')
  } finally {
    submitting.value = false
  }
}

// 取消
const handleCancel = () => {
  router.push('/products')
}

// 初始化
onMounted(async () => {
  await fetchOptions()
  await fetchProduct()
})
</script>

<style lang="scss" scoped>
.form-container {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-lg);

  @include mobile-only {
    padding: var(--spacing-md);
  }
}

.form-steps {
  margin-bottom: var(--spacing-xl);

  @include mobile-only {
    :deep(.el-step__title) {
      font-size: var(--font-sm);
    }
  }
}

.product-form {
  margin-bottom: var(--spacing-xl);
}

.form-actions {
  display: flex;
  justify-content: center;
  gap: var(--spacing-md);

  @include mobile-only {
    flex-direction: column-reverse;

    .el-button {
      width: 100%;
    }
  }
}
</style>
```

### 动态表单

```vue
<!-- views/example/DynamicForm.vue -->
<template>
  <div class="dynamic-form">
    <MobileForm
      ref="formRef"
      v-model="formData"
      :fields="dynamicFields"
      :rules="dynamicRules"
      :loading="loading"
      @field-change="handleFieldChange"
    >
      <!-- 自定义字段插槽 -->
      <template #custom-field="{ field, value, onChange }">
        <component
          :is="field.component"
          v-bind="field.attrs"
          :model-value="value"
          @update:model-value="onChange"
        />
      </template>
    </MobileForm>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MobileForm from '@/components/MobileForm.vue'
import CustomDatePicker from './CustomDatePicker.vue'
import RichTextEditor from './RichTextEditor.vue'

// 表单数据
const formData = ref({
  type: '',
  name: '',
  // 动态字段
  custom_fields: {}
})

// 表单类型
const formTypes = [
  { label: '手机', value: 'phone' },
  { label: '配件', value: 'accessory' },
  { label: '服务', value: 'service' }
]

// 基础字段
const baseFields = [
  {
    prop: 'type',
    label: '类型',
    type: 'select',
    required: true,
    options: formTypes,
    onChange: (value) => {
      formData.value.custom_fields = {}
      generateDynamicFields(value)
    }
  },
  {
    prop: 'name',
    label: '名称',
    type: 'input',
    required: true,
    attrs: {
      placeholder: '请输入名称'
    }
  }
]

// 动态字段配置
const dynamicFieldConfigs: Record<string, any> = {
  phone: [
    {
      prop: 'brand',
      label: '品牌',
      type: 'select',
      required: true,
      options: [
        { label: 'Apple', value: 'apple' },
        { label: 'Samsung', value: 'samsung' },
        { label: 'Xiaomi', value: 'xiaomi' }
      ]
    },
    {
      prop: 'model',
      label: '型号',
      type: 'input',
      required: true
    },
    {
      prop: 'release_date',
      label: '发布日期',
      type: 'custom',
      component: CustomDatePicker,
      required: true
    },
    {
      prop: 'specifications',
      label: '规格说明',
      type: 'custom',
      component: RichTextEditor
    }
  ],

  accessory: [
    {
      prop: 'compatible_models',
      label: '兼容型号',
      type: 'select',
      required: true,
      attrs: {
        multiple: true,
        filterable: true
      }
    },
    {
      prop: 'material',
      label: '材质',
      type: 'radio',
      options: [
        { label: '硅胶', value: 'silicone' },
        { label: '塑料', value: 'plastic' },
        { label: '金属', value: 'metal' }
      ]
    }
  ],

  service: [
    {
      prop: 'duration',
      label: '服务时长',
      type: 'number',
      required: true,
      attrs: {
        min: 1,
        max: 365,
        suffix: '天'
      }
    },
    {
      prop: 'price_range',
      label: '价格区间',
      type: 'slider',
      attrs: {
        range: true,
        min: 0,
        max: 10000,
        step: 100
      }
    }
  ]
}

// 动态字段
const dynamicFields = ref(baseFields)

// 动态规则
const dynamicRules = computed(() => {
  const rules: any = {}

  // 基础字段规则
  rules.type = [
    { required: true, message: '请选择类型', trigger: 'change' }
  ]
  rules.name = [
    { required: true, message: '请输入名称', trigger: 'blur' }
  ]

  // 动态字段规则
  const currentType = formData.value.type
  if (currentType && dynamicFieldConfigs[currentType]) {
    dynamicFieldConfigs[currentType].forEach((field: any) => {
      if (field.required) {
        rules[`custom_fields.${field.prop}`] = [
          { required: true, message: `请填写${field.label}`, trigger: 'blur' }
        ]
      }
    })
  }

  return rules
})

// 生成动态字段
const generateDynamicFields = (type: string) => {
  if (!type || !dynamicFieldConfigs[type]) {
    dynamicFields.value = baseFields
    return
  }

  const fields = [...baseFields]

  dynamicFieldConfigs[type].forEach((fieldConfig: any) => {
    fields.push({
      ...fieldConfig,
      prop: `custom_fields.${fieldConfig.prop}`,
      span: 24
    })
  })

  dynamicFields.value = fields
}

// 字段变化处理
const handleFieldChange = (prop: string, value: any) => {
  console.log('Field changed:', prop, value)

  // 特殊处理
  if (prop === 'type') {
    generateDynamicFields(value)
  }
}

// 监听类型变化
watch(
  () => formData.value.type,
  (newType) => {
    if (newType) {
      generateDynamicFields(newType)
    }
  }
)

// 表单引用
const formRef = ref()

// 提交
const handleSubmit = async () => {
  if (!formRef.value) return

  const valid = await formRef.value.validate()
  if (!valid) return

  console.log('Form data:', formData.value)
}

// 重置
const resetForm = () => {
  formData.value = {
    type: '',
    name: '',
    custom_fields: {}
  }
  dynamicFields.value = baseFields
}
</script>

<style lang="scss" scoped>
.dynamic-form {
  padding: var(--spacing-lg);
}
</style>
```

---

## 布局组件示例 (Layout Examples)

### 标准页面布局

```vue
<!-- views/example/StandardPageLayout.vue -->
<template>
  <ResponsiveLayout
    :title="pageTitle"
    :subtitle="pageSubtitle"
    :breadcrumb="breadcrumb"
    :loading="pageLoading"
    :back-button="showBackButton"
    :show-header="showHeader"
    :show-footer="showFooter"
    @back="handleBack"
  >
    <!-- 头部操作区 -->
    <template #actions>
      <slot name="header-actions">
        <el-space>
          <el-button
            v-if="showRefresh"
            :icon="Refresh"
            @click="handleRefresh"
          >
            刷新
          </el-button>

          <el-button
            v-if="showExport"
            type="primary"
            :icon="Download"
            @click="handleExport"
          >
            导出
          </el-button>

          <el-button
            v-if="showCreate"
            type="primary"
            :icon="Plus"
            @click="handleCreate"
          >
            新建
          </el-button>
        </el-space>
      </slot>
    </template>

    <!-- 左侧边栏 -->
    <template #sidebar v-if="showSidebar">
      <div class="page-sidebar">
        <el-menu
          :default-active="activeMenu"
          mode="vertical"
          @select="handleMenuSelect"
        >
          <el-menu-item
            v-for="item in menuItems"
            :key="item.key"
            :index="item.key"
          >
            <el-icon v-if="item.icon">
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </el-menu>
      </div>
    </template>

    <!-- 标签页 -->
    <template #tabs v-if="showTabs">
      <el-tabs
        v-model="activeTab"
        type="card"
        @tab-change="handleTabChange"
      >
        <el-tab-pane
          v-for="tab in tabItems"
          :key="tab.key"
          :label="tab.label"
          :name="tab.key"
        >
          <!-- 主内容区 -->
          <div class="page-content">
            <slot :name="`tab-${tab.key}`">
              <!-- 默认内容 -->
              <component
                :is="tab.component"
                v-if="tab.component"
                v-bind="tab.props"
              />
            </slot>
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>

    <!-- 主内容区（无标签页） -->
    <template #content v-else>
      <div class="page-content">
        <slot>
          <!-- 默认内容插槽 -->
          <div class="default-content">
            <el-empty description="暂无内容" />
          </div>
        </slot>
      </div>
    </template>

    <!-- 底部操作区 -->
    <template #footer-actions v-if="showFooterActions">
      <div class="footer-actions">
        <slot name="footer-actions">
          <el-space>
            <el-button @click="handleCancel">取消</el-button>
            <el-button type="primary" @click="handleSave">保存</el-button>
          </el-space>
        </slot>
      </div>
    </template>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Refresh,
  Download,
  Plus,
  Document,
  Setting,
  DataAnalysis
} from '@element-plus/icons-vue'
import ResponsiveLayout from '@/components/ResponsiveLayout.vue'

interface Props {
  title?: string
  subtitle?: string
  breadcrumb?: Array<{ label: string; path?: string }>
  loading?: boolean
  backButton?: boolean
  header?: boolean
  footer?: boolean
  sidebar?: boolean
  tabs?: boolean
  refresh?: boolean
  export?: boolean
  create?: boolean
  footerActions?: boolean
  menuItems?: Array<{
    key: string
    label: string
    icon?: any
  }>
  tabItems?: Array<{
    key: string
    label: string
    component?: any
    props?: any
  }>
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  backButton: false,
  header: true,
  footer: false,
  sidebar: false,
  tabs: false,
  refresh: true,
  export: false,
  create: false,
  footerActions: false,
  breadcrumb: () => [],
  menuItems: () => [],
  tabItems: () => []
})

const emit = defineEmits<{
  refresh: []
  export: []
  create: []
  save: []
  cancel: []
  back: []
  menuSelect: [key: string]
  tabChange: [key: string]
}>()

const router = useRouter()

// 页面状态
const pageLoading = ref(false)
const showBackButton = ref(props.backButton)
const showHeader = ref(props.header)
const showFooter = ref(props.footer)
const showSidebar = ref(props.sidebar)
const showTabs = ref(props.tabs)
const showRefresh = ref(props.refresh)
const showExport = ref(props.export)
const showCreate = ref(props.create)
const showFooterActions = ref(props.footerActions)

// 菜单和标签状态
const activeMenu = ref('')
const activeTab = ref('')

// 页面标题
const pageTitle = computed(() => {
  return props.title || '页面标题'
})

const pageSubtitle = computed(() => {
  return props.subtitle || ''
})

// 面包屑
const breadcrumb = computed(() => {
  const defaultBreadcrumb = [
    { label: '首页', path: '/' }
  ]

  return [...defaultBreadcrumb, ...props.breadcrumb]
})

// 事件处理
const handleRefresh = () => {
  emit('refresh')
}

const handleExport = () => {
  emit('export')
}

const handleCreate = () => {
  emit('create')
}

const handleSave = () => {
  emit('save')
}

const handleCancel = () => {
  emit('cancel')
}

const handleBack = () => {
  emit('back')
  router.back()
}

const handleMenuSelect = (key: string) => {
  activeMenu.value = key
  emit('menuSelect', key)
}

const handleTabChange = (key: string) => {
  activeTab.value = key
  emit('tabChange', key)
}

// 初始化
onMounted(() => {
  // 设置默认激活状态
  if (props.menuItems.length > 0) {
    activeMenu.value = props.menuItems[0].key
  }

  if (props.tabItems.length > 0) {
    activeTab.value = props.tabItems[0].key
  }
})
</script>

<style lang="scss" scoped>
.page-content {
  padding: var(--spacing-lg);

  @include mobile-only {
    padding: var(--spacing-md);
  }
}

.page-sidebar {
  width: 200px;
  padding-right: var(--spacing-lg);

  @include mobile-only {
    width: 100%;
    padding-right: 0;
    margin-bottom: var(--spacing-md);
  }

  .el-menu {
    border-right: none;
  }
}

.footer-actions {
  padding: var(--spacing-md) 0;
  text-align: right;
  border-top: 1px solid var(--color-border-light);

  @include mobile-only {
    text-align: center;

    .el-space {
      width: 100%;
      justify-content: center;
    }
  }
}

.default-content {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}
</style>
```

---

## 导航组件示例 (Navigation Examples)

### 多级导航菜单

```vue
<!-- components/example/MultiLevelNavigation.vue -->
<template>
  <nav class="multi-level-nav">
    <!-- 顶部主导航 -->
    <div class="nav-header">
      <el-menu
        :default-active="activeTopMenu"
        mode="horizontal"
        :ellipsis="false"
        @select="handleTopMenuSelect"
      >
        <el-menu-item
          v-for="item in topMenuItems"
          :key="item.key"
          :index="item.key"
        >
          <el-icon v-if="item.icon">
            <component :is="item.icon" />
          </el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
    </div>

    <!-- 子导航 -->
    <div v-if="activeSubMenu" class="nav-sub">
      <div class="container">
        <el-menu
          :default-active="activeSubMenu"
          mode="horizontal"
          @select="handleSubMenuSelect"
        >
          <el-menu-item
            v-for="item in subMenuItems"
            :key="item.key"
            :index="item.key"
          >
            {{ item.label }}
          </el-menu-item>
        </el-menu>
      </div>
    </div>

    <!-- 面包屑导航 -->
    <div v-if="breadcrumb.length > 0" class="nav-breadcrumb">
      <div class="container">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item
            v-for="item in breadcrumb"
            :key="item.path"
            :to="item.path"
          >
            {{ item.label }}
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  House,
  ShoppingBag,
  Box,
  User,
  DataAnalysis,
  Setting
} from '@element-plus/icons-vue'

const route = useRoute()

// 顶部菜单配置
const topMenuItems = [
  {
    key: 'dashboard',
    label: '仪表板',
    icon: House,
    path: '/dashboard'
  },
  {
    key: 'sales',
    label: '销售管理',
    icon: ShoppingBag,
    children: [
      { key: 'orders', label: '订单管理', path: '/sales/orders' },
      { key: 'customers', label: '客户管理', path: '/sales/customers' },
      { key: 'reports', label: '销售报表', path: '/sales/reports' }
    ]
  },
  {
    key: 'inventory',
    label: '库存管理',
    icon: Box,
    children: [
      { key: 'products', label: '商品管理', path: '/inventory/products' },
      { key: 'stock', label: '库存查询', path: '/inventory/stock' },
      { key: 'warehouse', label: '仓库管理', path: '/inventory/warehouse' }
    ]
  },
  {
    key: 'users',
    label: '用户管理',
    icon: User,
    children: [
      { key: 'list', label: '用户列表', path: '/users/list' },
      { key: 'roles', label: '角色管理', path: '/users/roles' },
      { key: 'permissions', label: '权限管理', path: '/users/permissions' }
    ]
  },
  {
    key: 'analytics',
    label: '数据分析',
    icon: DataAnalysis,
    children: [
      { key: 'sales', label: '销售分析', path: '/analytics/sales' },
      { key: 'inventory', label: '库存分析', path: '/analytics/inventory' },
      { key: 'customer', label: '客户分析', path: '/analytics/customer' }
    ]
  },
  {
    key: 'system',
    label: '系统设置',
    icon: Setting,
    children: [
      { key: 'config', label: '系统配置', path: '/system/config' },
      { key: 'logs', label: '系统日志', path: '/system/logs' }
    ]
  }
]

// 状态
const activeTopMenu = ref('')
const activeSubMenu = ref('')

// 当前子菜单项
const subMenuItems = computed(() => {
  const topItem = topMenuItems.find(item => item.key === activeTopMenu.value)
  return topItem?.children || []
})

// 面包屑
const breadcrumb = computed(() => {
  const crumbs = []

  // 添加首页
  crumbs.push({ label: '首页', path: '/' })

  // 添加顶级菜单
  const topItem = topMenuItems.find(item => item.key === activeTopMenu.value)
  if (topItem) {
    crumbs.push({ label: topItem.label })
  }

  // 添加子菜单
  const subItem = subMenuItems.value.find(item => item.key === activeSubMenu.value)
  if (subItem) {
    crumbs.push({ label: subItem.label, path: subItem.path })
  }

  return crumbs
})

// 监听路由变化
watch(
  () => route.path,
  (newPath) => {
    // 根据路径确定激活的菜单项
    updateActiveMenu(newPath)
  },
  { immediate: true }
)

// 更新激活菜单
const updateActiveMenu = (path: string) => {
  // 遍历顶级菜单
  for (const topItem of topMenuItems) {
    if (!topItem.children) {
      // 没有子菜单的顶级菜单
      if (path === topItem.path) {
        activeTopMenu.value = topItem.key
        activeSubMenu.value = ''
        return
      }
    } else {
      // 有子菜单的顶级菜单
      for (const subItem of topItem.children) {
        if (path.startsWith(subItem.path)) {
          activeTopMenu.value = topItem.key
          activeSubMenu.value = subItem.key
          return
        }
      }
    }
  }

  // 默认选中仪表板
  activeTopMenu.value = 'dashboard'
  activeSubMenu.value = ''
}

// 事件处理
const handleTopMenuSelect = (key: string) => {
  const item = topMenuItems.find(i => i.key === key)

  if (!item) return

  if (item.children && item.children.length > 0) {
    // 有子菜单，显示第一个子菜单项
    activeTopMenu.value = key
    activeSubMenu.value = item.children[0].key
    router.push(item.children[0].path)
  } else {
    // 没有子菜单，直接跳转
    activeTopMenu.value = key
    activeSubMenu.value = ''
    router.push(item.path || '/')
  }
}

const handleSubMenuSelect = (key: string) => {
  const subItem = subMenuItems.value.find(item => item.key === key)
  if (subItem && subItem.path) {
    router.push(subItem.path)
  }
}

// 初始化
updateActiveMenu(route.path)
</script>

<style lang="scss" scoped>
.multi-level-nav {
  background: var(--color-bg-white);
  border-bottom: 1px solid var(--color-border-light);
}

.nav-header {
  .container {
    @include responsive-container;
  }

  .el-menu {
    border-bottom: none;
  }
}

.nav-sub {
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border-light);

  .container {
    @include responsive-container;
  }

  .el-menu {
    background: transparent;
    border-bottom: none;
  }
}

.nav-breadcrumb {
  padding: var(--spacing-sm) 0;

  .container {
    @include responsive-container;
  }
}

// 移动端适配
@include mobile-only {
  .nav-header {
    .el-menu {
      :deep(.el-menu-item) {
        padding: 0 var(--spacing-sm);
        font-size: var(--font-sm);

        span {
          display: none;
        }
      }
    }
  }

  .nav-sub {
    .el-menu {
      overflow-x: auto;
      white-space: nowrap;

      &::-webkit-scrollbar {
        display: none;
      }

      .el-menu-item {
        display: inline-block;
        float: none;
      }
    }
  }
}
</style>
```

### 移动端侧滑菜单

```vue
<!-- components/example/MobileSlideMenu.vue -->
<template>
  <div class="mobile-slide-menu">
    <!-- 遮罩层 -->
    <div
      v-show="visible"
      class="menu-mask"
      @click="handleClose"
    />

    <!-- 菜单面板 -->
    <transition name="slide">
      <div v-show="visible" class="menu-panel">
        <!-- 菜单头部 -->
        <div class="menu-header">
          <div class="user-info">
            <el-avatar :size="60" :src="user.avatar">
              {{ user.name.charAt(0) }}
            </el-avatar>
            <div class="user-details">
              <h3>{{ user.name }}</h3>
              <p>{{ user.role }}</p>
            </div>
          </div>
        </div>

        <!-- 菜单列表 -->
        <div class="menu-content">
          <el-menu
            :default-active="activeMenu"
            :collapse="false"
            @select="handleMenuSelect"
          >
            <template v-for="item in menuItems" :key="item.key">
              <!-- 分组标题 -->
              <div v-if="item.group" class="menu-group">
                {{ item.group }}
              </div>

              <!-- 菜单项 -->
              <el-menu-item
                :index="item.key"
                :disabled="item.disabled"
              >
                <el-icon v-if="item.icon">
                  <component :is="item.icon" />
                </el-icon>
                <span>{{ item.label }}</span>

                <!-- 徽标 -->
                <el-badge
                  v-if="item.badge"
                  :value="item.badge"
                  class="menu-badge"
                />

                <!-- 新功能标记 -->
                <el-tag v-if="item.new" size="small" type="danger">
                  新
                </el-tag>
              </el-menu-item>
            </template>
          </el-menu>
        </div>

        <!-- 菜单底部 -->
        <div class="menu-footer">
          <div class="footer-item" @click="handleSettings">
            <el-icon><Setting /></el-icon>
            <span>设置</span>
          </div>

          <div class="footer-item" @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
            <span>退出登录</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import {
  House,
  ShoppingBag,
  Box,
  User,
  DataAnalysis,
  Setting,
  SwitchButton,
  Document,
  Bell,
  QuestionFilled
} from '@element-plus/icons-vue'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 菜单显示状态
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 用户信息
const user = computed(() => userStore.user || {
  name: '测试用户',
  role: '销售员',
  avatar: ''
})

// 菜单配置
const menuItems = [
  // 核心功能
  {
    group: '核心功能'
  },
  {
    key: 'dashboard',
    label: '仪表板',
    icon: House,
    path: '/dashboard'
  },
  {
    key: 'sales',
    label: '销售管理',
    icon: ShoppingBag,
    path: '/sales/orders',
    badge: 5
  },
  {
    key: 'inventory',
    label: '库存管理',
    icon: Box,
    path: '/inventory/products'
  },

  // 客户管理
  {
    group: '客户管理'
  },
  {
    key: 'customers',
    label: '客户列表',
    icon: User,
    path: '/customers'
  },
  {
    key: 'customer-tags',
    label: '客户标签',
    icon: Document,
    path: '/customers/tags',
    new: true
  },

  // 数据分析
  {
    group: '数据分析'
  },
  {
    key: 'analytics',
    label: '数据报表',
    icon: DataAnalysis,
    path: '/analytics'
  },

  // 其他
  {
    group: '其他'
  },
  {
    key: 'notifications',
    label: '消息通知',
    icon: Bell,
    path: '/notifications',
    badge: 12
  },
  {
    key: 'help',
    label: '帮助中心',
    icon: QuestionFilled,
    path: '/help'
  }
]

// 当前激活菜单
const activeMenu = ref('')

// 关闭菜单
const handleClose = () => {
  visible.value = false
}

// 菜单选择
const handleMenuSelect = (key: string) => {
  const item = menuItems.find(i => i.key === key)
  if (item && item.path) {
    router.push(item.path)
    handleClose()
  }
}

// 设置
const handleSettings = () => {
  router.push('/settings')
  handleClose()
}

// 退出登录
const handleLogout = async () => {
  try {
    await userStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('退出失败:', error)
  }
}

// 更新激活菜单
const updateActiveMenu = () => {
  const currentPath = route.path

  // 精确匹配
  for (const item of menuItems) {
    if (item.path === currentPath) {
      activeMenu.value = item.key
      return
    }
  }

  // 路径前缀匹配
  for (const item of menuItems) {
    if (item.path && currentPath.startsWith(item.path)) {
      activeMenu.value = item.key
      return
    }
  }

  // 默认选中仪表板
  activeMenu.value = 'dashboard'
}

onMounted(() => {
  updateActiveMenu()
})

// 监听路由变化
router.afterEach(() => {
  updateActiveMenu()
})
</script>

<style lang="scss" scoped>
.mobile-slide-menu {
  .menu-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: var(--z-modal-backdrop);
  }

  .menu-panel {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    max-width: 80vw;
    background: var(--color-bg-white);
    z-index: var(--z-modal);
    display: flex;
    flex-direction: column;
  }
}

.menu-header {
  padding: var(--spacing-lg);
  background: var(--color-primary);
  color: white;

  .user-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);

    .user-details {
      flex: 1;

      h3 {
        margin: 0;
        font-size: var(--font-lg);
        font-weight: var(--font-weight-semibold);
      }

      p {
        margin: var(--spacing-xs) 0 0;
        opacity: 0.8;
        font-size: var(--font-sm);
      }
    }
  }
}

.menu-content {
  flex: 1;
  overflow-y: auto;

  .menu-group {
    padding: var(--spacing-md) var(--spacing-lg) var(--spacing-sm);
    font-size: var(--font-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    background: var(--color-bg-page);
  }

  .el-menu {
    border-right: none;

    .el-menu-item {
      position: relative;

      .menu-badge {
        position: absolute;
        right: var(--spacing-lg);
        top: 50%;
        transform: translateY(-50%);
      }

      .el-tag {
        margin-left: var(--spacing-sm);
      }
    }
  }
}

.menu-footer {
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);

  .footer-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    cursor: pointer;
    border-radius: var(--border-radius);
    transition: all 0.3s;

    &:hover {
      background: var(--color-bg-page);
    }

    &:first-child {
      margin-bottom: var(--spacing-sm);
    }

    .el-icon {
      font-size: 18px;
    }

    span {
      color: var(--color-text-regular);
    }
  }
}

// 动画
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}

// 安全区域适配
@include safe-area($left: true);
</style>
```

---

## 组件组合模式 (Component Patterns)

### 1. 弹窗 + 表单组合

```vue
<!-- components/patterns/ModalFormPattern.vue -->
<template>
  <MobileDialog
    v-model="dialogVisible"
    :title="title"
    :width="width"
    :loading="loading"
    @confirm="handleSubmit"
  >
    <MobileForm
      ref="formRef"
      v-model="formData"
      :fields="fields"
      :rules="rules"
      :label-width="120"
    />
  </MobileDialog>
</template>

<script setup lang="ts">
// 通用的弹窗表单组合组件
</script>
```

### 2. 表格 + 搜索组合

```vue
<!-- components/patterns/TableSearchPattern.vue -->
<template>
  <div class="table-search-pattern">
    <SearchBar
      v-model="searchForm"
      :fields="searchFields"
      @search="handleSearch"
      @reset="handleReset"
    />

    <MobileTable
      :data="data"
      :columns="columns"
      :loading="loading"
      :pagination="pagination"
    />
  </div>
</template>

<script setup lang="ts">
// 通用的表格搜索组合组件
</script>
```

### 3. 布局 + 导航组合

```vue
<!-- components/patterns/LayoutNavigationPattern.vue -->
<template>
  <ResponsiveLayout>
    <template #sidebar>
      <SideNavigation :menu-items="menuItems" />
    </template>

    <template #content>
      <router-view />
    </template>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
// 通用的布局导航组合组件
</script>
```

---

## 最佳实践总结

### 1. 组件使用原则

- **优先使用标准组件**：MobileDialog、MobileTable、MobileForm
- **保持一致性**：相同功能使用相同组件
- **响应式优先**：确保移动端体验
- **性能考虑**：合理使用懒加载

### 2. 常见模式

- **弹窗表单**：MobileDialog + MobileForm
- **列表页面**：ResponsiveLayout + MobileTable
- **表单页面**：ResponsiveLayout + MobileForm
- **详情页面**：ResponsiveLayout + Card组件

### 3. 注意事项

- **权限控制**：使用 v-permission 指令
- **错误处理**：统一错误提示
- **加载状态**：适当的 loading 状态
- **国际化**：文本内容使用 i18n

---

**更新日期**：2025-12-20
**版本**：v2.0.0
**维护者**：TF2025 前端开发团队