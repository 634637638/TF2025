# TF2025 移动端组件示例

## 📱 概述

本文档提供了 TF2025 项目中常用的移动端组件示例，帮助开发者快速实现移动端页面。

## 🎯 页面模板示例

### 1. 列表页面模板

```vue
<template>
  <ResponsiveLayout
    title="客户管理"
    :show-mobile-header="true"
    :show-menu-button="true"
    :fab-actions="[
      {
        id: 'add',
        icon: Plus,
        label: '添加客户',
        handler: handleAdd,
        type: 'primary'
      }
    ]"
  >
    <!-- 搜索栏 -->
    <div class="search-section">
      <el-input
        v-model="searchQuery"
        placeholder="搜索客户..."
        prefix-icon="Search"
        clearable
        @input="handleSearch"
      />
    </div>

    <!-- 移动端卡片视图 -->
    <div v-if="isMobile" class="mobile-card-list">
      <div
        v-for="customer in filteredCustomers"
        :key="customer.id"
        class="customer-card"
        @click="handleView(customer)"
      >
        <div class="card-header">
          <div class="customer-info">
            <h3 class="customer-name">{{ customer.name }}</h3>
            <p class="customer-phone">{{ customer.phone }}</p>
          </div>
          <el-tag
            :type="customer.status === 'active' ? 'success' : 'info'"
            size="small"
          >
            {{ customer.status === 'active' ? '活跃' : '休眠' }}
          </el-tag>
        </div>
        <div class="card-body">
          <p class="customer-address">
            <el-icon><Location /></el-icon>
            {{ customer.address }}
          </p>
          <div class="customer-stats">
            <span>订单: {{ customer.orderCount }}</span>
            <span>消费: ¥{{ customer.totalSpent }}</span>
          </div>
        </div>
        <div class="card-actions">
          <el-button
            size="small"
            @click.stop="handleEdit(customer)"
          >
            编辑
          </el-button>
          <el-button
            size="small"
            type="danger"
            @click.stop="handleDelete(customer)"
          >
            删除
          </el-button>
        </div>
      </div>
    </div>

    <!-- 桌面端表格视图 -->
    <div v-else class="desktop-table">
      <el-table :data="filteredCustomers" v-loading="loading">
        <el-table-column prop="name" label="客户姓名" />
        <el-table-column prop="phone" label="手机号" />
        <el-table-column prop="address" label="地址" />
        <el-table-column prop="orderCount" label="订单数" />
        <el-table-column prop="totalSpent" label="消费总额" />
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <el-pagination
      v-if="!isMobile"
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      layout="total, sizes, prev, pager, next, jumper"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </ResponsiveLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ResponsiveLayout } from '@/components'
import { useResponsive, useNotification } from '@/composables'

const router = useRouter()
const { isMobile } = useResponsive()
const { success } = useNotification()

// 数据
const searchQuery = ref('')
const loading = ref(false)
const customers = ref([])
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

// 计算属性
const filteredCustomers = computed(() => {
  if (!searchQuery.value) return customers.value
  return customers.value.filter(customer =>
    customer.name.includes(searchQuery.value) ||
    customer.phone.includes(searchQuery.value)
  )
})

// 方法
const handleAdd = () => {
  router.push('/customers/create')
}

const handleView = (customer) => {
  router.push(`/customers/${customer.id}`)
}

const handleEdit = (customer) => {
  router.push(`/customers/${customer.id}/edit`)
}

const handleDelete = (customer) => {
  ElMessageBox.confirm('确定要删除这个客户吗？', '提示', {
    type: 'warning'
  }).then(() => {
    // 删除逻辑
    success('删除成功')
  })
}

const handleSearch = () => {
  // 搜索逻辑
}

const handleSizeChange = (val) => {
  pagination.value.pageSize = val
  // 重新加载数据
}

const handleCurrentChange = (val) => {
  pagination.value.page = val
  // 重新加载数据
}
</script>

<style lang="scss" scoped>
.search-section {
  margin-bottom: 16px;
}

.mobile-card-list {
  padding: 0 16px;
}

.customer-card {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s;

  &:active {
    transform: scale(0.98);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.customer-name {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.customer-phone {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.card-body {
  margin-bottom: 12px;
}

.customer-address {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0 0 8px 0;

  .el-icon {
    margin-right: 4px;
  }
}

.customer-stats {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.desktop-table {
  margin-top: 16px;
}
</style>
```

### 2. 表单页面模板

```vue
<template>
  <ResponsiveLayout
    :title="isEdit ? '编辑客户' : '新建客户'"
    :show-back-button="true"
    :show-mobile-header="true"
  >
    <div class="form-container">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <!-- 基本信息 -->
        <div class="form-section">
          <h3 class="section-title">基本信息</h3>

          <el-form-item label="客户姓名" prop="name">
            <el-input
              v-model="formData.name"
              placeholder="请输入客户姓名"
              clearable
            />
          </el-form-item>

          <el-form-item label="手机号" prop="phone">
            <el-input
              v-model="formData.phone"
              placeholder="请输入手机号"
              type="tel"
              maxlength="11"
              clearable
            />
          </el-form-item>

          <el-form-item label="性别" prop="gender">
            <el-radio-group v-model="formData.gender">
              <el-radio label="male">男</el-radio>
              <el-radio label="female">女</el-radio>
            </el-radio-group>
          </el-form-item>
        </div>

        <!-- 详细信息 -->
        <div class="form-section">
          <h3 class="section-title">详细信息</h3>

          <el-form-item label="生日" prop="birthday">
            <el-date-picker
              v-model="formData.birthday"
              type="date"
              placeholder="选择生日"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="地址" prop="address">
            <el-input
              v-model="formData.address"
              type="textarea"
              :rows="3"
              placeholder="请输入详细地址"
              maxlength="200"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="备注" prop="remark">
            <el-input
              v-model="formData.remark"
              type="textarea"
              :rows="3"
              placeholder="请输入备注信息"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </div>

        <!-- 提交按钮 -->
        <div class="form-actions">
          <el-button
            type="primary"
            native-type="submit"
            :loading="submitting"
            size="large"
            style="width: 100%"
          >
            {{ isEdit ? '更新' : '创建' }}
          </el-button>
        </div>
      </el-form>
    </div>
  </ResponsiveLayout>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ResponsiveLayout } from '@/components'
import { useResponsive, useNotification } from '@/composables'

const route = useRoute()
const router = useRouter()
const { isMobile } = useResponsive()
const { success } = useNotification()

// 表单相关
const formRef = ref<FormInstance>()
const submitting = ref(false)

// 判断是编辑还是新建
const isEdit = computed(() => !!route.params.id)

// 表单数据
const formData = reactive({
  name: '',
  phone: '',
  gender: 'male',
  birthday: '',
  address: '',
  remark: ''
})

// 表单验证规则
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入客户姓名', trigger: 'blur' },
    { min: 2, max: 20, message: '姓名长度在 2 到 20 个字符', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  gender: [
    { required: true, message: '请选择性别', trigger: 'change' }
  ]
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    const valid = await formRef.value.validate()
    if (!valid) return

    submitting.value = true

    // 调用 API
    const api = isEdit.value
      ? customerApi.update(route.params.id, formData)
      : customerApi.create(formData)

    await api

    success(isEdit.value ? '更新成功' : '创建成功')
    router.back()
  } catch (error) {
    console.error('提交失败:', error)
  } finally {
    submitting.value = false
  }
}

// 加载数据（编辑模式）
const loadData = async () => {
  if (!isEdit.value) return

  try {
    const { data } = await customerApi.getById(route.params.id)
    Object.assign(formData, data)
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

// 初始化
loadData()
</script>

<style lang="scss" scoped>
.form-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

.form-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 20px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--el-color-primary);
}

.form-actions {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}

// 移动端优化
@media (max-width: 768px) {
  .form-container {
    padding: 12px;
  }

  .section-title {
    font-size: 16px;
  }
}
</style>
```

### 3. 详情页面模板

```vue
<template>
  <ResponsiveLayout
    title="客户详情"
    :show-back-button="true"
    :show-menu-button="true"
    :fab-actions="[
      {
        id: 'edit',
        icon: Edit,
        label: '编辑',
        handler: handleEdit,
        type: 'primary'
      }
    ]"
  >
    <div v-loading="loading" class="detail-container">
      <!-- 基本信息 -->
      <div class="info-card">
        <div class="card-header">
          <div class="avatar">
            <el-avatar :size="64" :src="customer.avatar">
              {{ customer.name?.charAt(0) }}
            </el-avatar>
          </div>
          <div class="basic-info">
            <h2 class="customer-name">{{ customer.name }}</h2>
            <p class="customer-phone">
              <el-icon><Phone /></el-icon>
              {{ customer.phone }}
            </p>
            <el-tag
              :type="customer.status === 'active' ? 'success' : 'info'"
              size="small"
            >
              {{ customer.status === 'active' ? '活跃客户' : '休眠客户' }}
            </el-tag>
          </div>
        </div>
      </div>

      <!-- 详细信息列表 -->
      <div class="detail-list">
        <div class="detail-item">
          <span class="label">性别</span>
          <span class="value">{{ customer.gender === 'male' ? '男' : '女' }}</span>
        </div>
        <div class="detail-item">
          <span class="label">生日</span>
          <span class="value">{{ customer.birthday || '未设置' }}</span>
        </div>
        <div class="detail-item">
          <span class="label">地址</span>
          <span class="value">{{ customer.address || '未设置' }}</span>
        </div>
        <div class="detail-item">
          <span class="label">注册时间</span>
          <span class="value">{{ formatDate(customer.createdAt) }}</span>
        </div>
      </div>

      <!-- 统计数据 -->
      <div class="stats-card">
        <h3 class="card-title">消费统计</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">{{ customer.orderCount || 0 }}</div>
            <div class="stat-label">订单数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">¥{{ customer.totalSpent || 0 }}</div>
            <div class="stat-label">消费总额</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">¥{{ customer.avgSpent || 0 }}</div>
            <div class="stat-label">平均消费</div>
          </div>
        </div>
      </div>

      <!-- 最近订单 -->
      <div class="recent-orders">
        <div class="section-header">
          <h3 class="section-title">最近订单</h3>
          <el-button type="primary" link @click="viewAllOrders">
            查看全部
          </el-button>
        </div>
        <div class="order-list">
          <div
            v-for="order in recentOrders"
            :key="order.id"
            class="order-item"
            @click="viewOrder(order)"
          >
            <div class="order-info">
              <div class="order-no">订单号：{{ order.orderNo }}</div>
              <div class="order-date">{{ formatDate(order.createdAt) }}</div>
            </div>
            <div class="order-amount">¥{{ order.amount }}</div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button
          type="primary"
          size="large"
          style="width: 100%"
          @click="handleCreateOrder"
        >
          创建订单
        </el-button>
      </div>
    </div>
  </ResponsiveLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Edit, Phone } from '@element-plus/icons-vue'
import { ResponsiveLayout } from '@/components'
import { useResponsive, useNotification } from '@/composables'

const router = useRouter()
const { isMobile } = useResponsive()
const { success } = useNotification()

// 数据
const loading = ref(false)
const customer = ref({})
const recentOrders = ref([])

// 方法
const handleEdit = () => {
  router.push(`/customers/${customer.value.id}/edit`)
}

const handleCreateOrder = () => {
  router.push({
    path: '/sales/create',
    query: { customerId: customer.value.id }
  })
}

const viewAllOrders = () => {
  router.push({
    path: '/sales',
    query: { customerId: customer.value.id }
  })
}

const viewOrder = (order) => {
  router.push(`/sales/orders/${order.id}`)
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    // 加载客户信息
    const { data } = await customerApi.getById(route.params.id)
    customer.value = data

    // 加载最近订单
    const { data: orders } = await orderApi.getList({
      customerId: route.params.id,
      pageSize: 5
    })
    recentOrders.value = orders.list || []
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.detail-container {
  padding: 16px;
}

.info-card {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.basic-info {
  flex: 1;
}

.customer-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.customer-phone {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0 0 8px 0;

  .el-icon {
    margin-right: 4px;
  }
}

.detail-list {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 4px 0;
  margin-bottom: 16px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-child {
    border-bottom: none;
  }
}

.label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.value {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.stats-card {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.recent-orders {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;

  &:active {
    transform: scale(0.98);
  }
}

.order-no {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.order-date {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.order-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-danger);
}

.action-buttons {
  padding: 20px 0;
}

// 移动端优化
@media (max-width: 768px) {
  .detail-container {
    padding: 12px;
  }

  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .stat-value {
    font-size: 18px;
  }
}
</style>
```

## 🔧 高级组件示例

### 1. 下拉刷新组件

```vue
<template>
  <div
    ref="containerRef"
    class="pull-refresh-container"
    :style="{ transform: `translateY(${translateY}px)` }"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <div class="refresh-indicator" :class="{ 'active': isRefreshing }">
      <el-icon v-if="isRefreshing" class="is-loading">
        <Loading />
      </el-icon>
      <span v-else>{{ refreshText }}</span>
    </div>

    <slot />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['refresh'])

const containerRef = ref()
const isRefreshing = ref(false)
const startY = ref(0)
const currentY = ref(0)
const pulling = ref(false)
const translateY = ref(0)
const threshold = 60

const refreshText = computed(() => {
  if (!pulling.value) return '下拉刷新'
  if (translateY.value < threshold) return '下拉刷新'
  return '释放立即刷新'
})

const handleTouchStart = (e) => {
  if (isRefreshing.value) return
  if (containerRef.value.scrollTop !== 0) return

  startY.value = e.touches[0].clientY
  pulling.value = true
}

const handleTouchMove = (e) => {
  if (!pulling.value || isRefreshing.value) return

  currentY.value = e.touches[0].clientY
  const distance = currentY.value - startY.value

  if (distance > 0) {
    e.preventDefault()
    translateY.value = Math.min(distance * 0.5, 120)
  }
}

const handleTouchEnd = async () => {
  if (!pulling.value) return

  pulling.value = false

  if (translateY.value >= threshold && !isRefreshing.value) {
    isRefreshing.value = true
    translateY.value = 40

    try {
      await emit('refresh')
    } finally {
      isRefreshing.value = false
      translateY.value = 0
    }
  } else {
    translateY.value = 0
  }
}
</script>

<style lang="scss" scoped>
.pull-refresh-container {
  position: relative;
  transition: transform 0.3s;
  min-height: 100vh;
}

.refresh-indicator {
  position: absolute;
  top: -40px;
  left: 0;
  right: 0;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--el-text-color-secondary);

  &.active {
    top: 0;
  }

  .el-icon {
    font-size: 20px;
    margin-right: 8px;
  }
}
</style>
```

### 2. 虚拟滚动列表

```vue
<template>
  <div
    ref="containerRef"
    class="virtual-list"
    :style="{ height: containerHeight + 'px' }"
    @scroll="handleScroll"
  >
    <div
      class="virtual-list-phantom"
      :style="{ height: totalHeight + 'px' }"
    ></div>

    <div
      class="virtual-list-content"
      :style="{ transform: `translateY(${offsetY}px)` }"
    >
      <div
        v-for="item in visibleItems"
        :key="item.index"
        class="virtual-list-item"
        :style="{ height: itemHeight + 'px' }"
      >
        <slot :item="item.data" :index="item.index" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  itemHeight: {
    type: Number,
    default: 50
  },
  containerHeight: {
    type: Number,
    required: true
  },
  bufferSize: {
    type: Number,
    default: 5
  }
})

const containerRef = ref()
const scrollTop = ref(0)
const startIndex = ref(0)
const endIndex = ref(0)

const totalHeight = computed(() => props.items.length * props.itemHeight)
const visibleCount = computed(() => Math.ceil(props.containerHeight / props.itemHeight))

const visibleItems = computed(() => {
  const start = Math.max(0, startIndex.value - props.bufferSize)
  const end = Math.min(props.items.length, endIndex.value + props.bufferSize)

  return props.items.slice(start, end).map((item, index) => ({
    data: item,
    index: start + index
  }))
})

const offsetY = computed(() => startIndex.value * props.itemHeight)

const handleScroll = () => {
  scrollTop.value = containerRef.value.scrollTop
  startIndex.value = Math.floor(scrollTop.value / props.itemHeight)
  endIndex.value = Math.min(
    startIndex.value + visibleCount.value,
    props.items.length - 1
  )
}

onMounted(() => {
  handleScroll()
})
</script>

<style lang="scss" scoped>
.virtual-list {
  overflow-y: auto;
  position: relative;
}

.virtual-list-phantom {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: -1;
}

.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.virtual-list-item {
  overflow: hidden;
}
</style>
```

## 📚 相关文档

- [移动端开发规范](./mobile-development-standards.md)
- [响应式布局组件](../components/ResponsiveLayout.vue)
- [Element Plus 移动端指南](https://element-plus.org/zh-CN/guide/mobile.html)

---

**最后更新**：2025-12-18
**维护团队**：TF2025前端开发团队