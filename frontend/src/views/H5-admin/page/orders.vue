<!--
  销售管理 - H5订单管理
  功能：查看、审核、发货H5订单
-->
<template>
  <PermissionDenied
    v-if="!canView"
    :can-view="canView"
    module-key="h5-admin-orders"
    module-name="商城订单"
    permission-code="h5-orders:view"
  />

  <div v-else class="sales-management-page">
    <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewOrderField('stats_total_orders')" class="stat-card" @click="filterByStatus('')">
        <div class="stat-icon bg-gradient-pending">
          <i class="fas fa-shopping-cart"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ statistics.total?.total_orders || 0 }}</div>
          <div class="stat-label">全部订单</div>
        </div>
      </div>
      <div v-if="canViewOrderField('stats_pending_orders')" class="stat-card" @click="filterByStatus('pending')">
        <div class="stat-icon bg-gradient-processing">
          <i class="fas fa-clock"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getStatusCount('pending') }}</div>
          <div class="stat-label">待支付</div>
        </div>
      </div>
      <div v-if="canViewOrderField('stats_paid_orders')" class="stat-card" @click="filterByStatus('paid')">
        <div class="stat-icon bg-gradient-shipped">
          <i class="fas fa-hourglass-half"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getStatusCount('paid') }}</div>
          <div class="stat-label">待审核</div>
        </div>
      </div>
      <div v-if="canViewOrderField('stats_confirmed_orders')" class="stat-card" @click="filterByStatus('confirmed')">
        <div class="stat-icon bg-gradient-completed">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getStatusCount('confirmed') }}</div>
          <div class="stat-label">待发货</div>
        </div>
      </div>
      <div v-if="canViewOrderField('stats_shipped_orders')" class="stat-card" @click="filterByStatus('shipped')">
        <div class="stat-icon bg-gradient-refunded">
          <i class="fas fa-truck"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getStatusCount('shipped') }}</div>
          <div class="stat-label">已发货</div>
        </div>
      </div>
      <div v-if="canViewOrderField('stats_completed_orders')" class="stat-card" @click="filterByStatus('completed')">
        <div class="stat-icon bg-gradient-cancelled">
          <i class="fas fa-check-double"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getStatusCount('completed') }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" :inline="true" class="filter-form">
        <el-form-item v-if="canViewOrderField('filter_status')" label="订单状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable @change="handleFilterChange">
            <el-option label="全部" value=""></el-option>
            <el-option label="待支付" value="pending"></el-option>
            <el-option label="待审核" value="paid"></el-option>
            <el-option label="待发货" value="confirmed"></el-option>
            <el-option label="已发货" value="shipped"></el-option>
            <el-option label="已完成" value="completed"></el-option>
            <el-option label="已取消" value="cancelled"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item v-if="canViewOrderField('filter_customer_name')" label="客户姓名">
          <el-input v-model="filters.customer_name" placeholder="输入客户姓名" clearable class="w-36" @keyup.enter="handleFilterChange"/>
        </el-form-item>
        <el-form-item v-if="canViewOrderField('filter_customer_phone')" label="客户电话">
          <el-input v-model="filters.customer_phone" placeholder="输入电话" clearable class="w-36" @keyup.enter="handleFilterChange"/>
        </el-form-item>
        <el-form-item v-if="canViewOrderField('filter_order_number')" label="订单号">
          <el-input v-model="filters.order_number" placeholder="输入订单号" clearable class="w-44" @keyup.enter="handleFilterChange"/>
        </el-form-item>
        <el-form-item v-if="canViewOrderField('filter_date_range')" label="下单时间">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            clearable
            class="w-60"
            @change="handleFilterChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilterChange">搜索</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 订单列表 -->
    <el-card class="table-card" shadow="never" v-loading="loading">
      <el-table :data="orders" class="w-full" :border="true">
        <el-table-column prop="order_number" label="订单号" width="160" fixed>
          <template #default="{ row }">
            <el-tag size="small">{{ row.order_number }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户姓名" width="100"/>
        <el-table-column prop="customer_phone" label="联系电话" width="120"/>
        <el-table-column label="订单金额" width="100" align="right">
          <template #default="{ row }">
            <span class="amount">¥{{ parseFloat(row.total_amount).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="下单时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <!-- 待支付状态：显示"查看"和"取消" -->
              <template v-if="row.status === 'pending'">
                <el-button size="small" type="info" @click="viewOrder(row)" link>
                  <i class="fas fa-eye"></i> 查看
                </el-button>
                <el-button
                  v-if="canEdit"
                  size="small"
                  type="danger"
                  link
                  @click="cancelOrder(row)"
                >
                  取消
                </el-button>
              </template>

              <!-- 待审核状态：显示"查看"、"通过"、"拒绝"、"取消" -->
              <template v-if="row.status === 'paid'">
                <el-button size="small" type="info" @click="viewOrder(row)" link>
                  <i class="fas fa-eye"></i> 查看
                </el-button>
                <el-button
                  v-if="canEdit"
                  size="small"
                  type="success"
                  link
                  @click="confirmOrder(row)"
                >
                  通过
                </el-button>
                <el-button
                  v-if="canEdit"
                  size="small"
                  type="warning"
                  link
                  @click="rejectOrder(row)"
                >
                  拒绝
                </el-button>
                <el-button
                  v-if="canEdit"
                  size="small"
                  type="danger"
                  link
                  @click="cancelOrder(row)"
                >
                  取消
                </el-button>
              </template>

              <!-- 待发货状态：显示"查看"和"发货" -->
              <template v-if="row.status === 'confirmed'">
                <el-button size="small" type="info" @click="viewOrder(row)" link>
                  <i class="fas fa-eye"></i> 查看
                </el-button>
                <el-button
                  v-if="canEdit"
                  size="small"
                  type="primary"
                  link
                  @click="shipOrder(row)"
                >
                  发货
                </el-button>
              </template>

              <!-- 已发货状态：显示"查看"和"完成" -->
              <template v-if="row.status === 'shipped'">
                <el-button size="small" type="info" @click="viewOrder(row)" link>
                  <i class="fas fa-eye"></i> 查看
                </el-button>
                <el-button
                  v-if="canEdit"
                  size="small"
                  type="success"
                  link
                  @click="completeOrder(row)"
                >
                  完成
                </el-button>
              </template>

              <!-- 已完成/已取消状态：只显示"查看" -->
              <template v-if="['completed', 'cancelled'].includes(row.status)">
                <el-button size="small" type="info" @click="viewOrder(row)" link>
                  <i class="fas fa-eye"></i> 查看
                </el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <Pagination
          v-model:current="pagination.page"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          :show-range="true"
          @change="handlePaginationChange"
        />
      </div>
    </el-card>

    <!-- 订单详情弹窗 -->
    <MobileDialog
      v-model="showDetailDialog"
      :title="`订单详情 - ${currentOrder?.order_number || ''}`"
      width="800px"
      :close-on-click-modal="false"
      dialog-class="h5-order-dialog h5-order-detail-dialog"
      :show-default-footer="false"
    >
      <div v-if="currentOrder" class="order-detail">
        <!-- 订单状态 -->
        <div class="detail-section">
          <div class="section-title">订单状态</div>
          <div class="status-info">
            <el-tag :type="getStatusType(currentOrder.status)" size="large">
              {{ getStatusText(currentOrder.status) }}
            </el-tag>
            <span class="order-time">下单时间：{{ formatTime(currentOrder.created_at) }}</span>
          </div>
          <!-- 状态时间线 -->
          <div class="status-timeline" v-if="getStatusTimeline(currentOrder).length > 0">
            <div v-for="(item, index) in getStatusTimeline(currentOrder)" :key="index" class="timeline-item">
              <div class="timeline-dot" :class="{ active: item.active }"></div>
              <div class="timeline-content">
                <div class="timeline-title">{{ item.title }}</div>
                <div class="timeline-time" v-if="item.time">{{ formatTime(item.time) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 客户信息 -->
        <div class="detail-section">
          <div class="section-title">客户信息</div>
          <div class="info-grid">
            <div class="info-item">
              <label>客户姓名</label>
              <span>{{ currentOrder.customer_name }}</span>
            </div>
            <div class="info-item">
              <label>联系电话</label>
              <span>{{ currentOrder.customer_phone }}</span>
            </div>
            <div class="info-item full-width" v-if="currentOrder.customer_address">
              <label>收货地址</label>
              <span>{{ currentOrder.customer_address }}</span>
            </div>
          </div>
        </div>

        <!-- 订单商品 -->
        <div class="detail-section">
          <div class="section-title">商品信息</div>
          <div class="order-items">
            <div v-for="item in currentOrder.items" :key="item.id" class="order-item">
              <div class="item-info">
                <div class="item-name">{{ item.phone_info?.brand }} {{ item.phone_info?.model }}</div>
                <div class="item-specs">
                  <span v-if="item.phone_info?.color">{{ item.phone_info.color }}</span>
                  <span v-if="item.phone_info?.memory"> | {{ item.phone_info.memory }}</span>
                </div>
              </div>
              <div class="item-quantity">x{{ item.quantity }}</div>
              <div class="item-price">¥{{ parseFloat(item.sale_price).toFixed(2) }}</div>
              <div class="item-subtotal">¥{{ parseFloat(item.subtotal).toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <!-- 价格信息 -->
        <div class="detail-section">
          <div class="section-title">价格信息</div>
          <div class="price-summary">
            <div class="price-row">
              <span>商品总额</span>
              <span>¥{{ parseFloat(currentOrder.total_amount).toFixed(2) }}</span>
            </div>
            <div class="price-row total">
              <span>应付金额</span>
              <span class="total-amount">¥{{ parseFloat(currentOrder.total_amount).toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- 备注 -->
        <div class="detail-section" v-if="currentOrder.remarks">
          <div class="section-title">订单备注</div>
          <p>{{ currentOrder.remarks }}</p>
        </div>

        <!-- 物流信息（已发货状态） -->
        <div class="detail-section" v-if="['shipped', 'completed'].includes(currentOrder.status) && currentOrder.shipping_info">
          <div class="section-title">物流信息</div>
          <div class="shipping-info">
            <div class="info-item">
              <label>物流公司</label>
              <span>{{ currentOrder.shipping_info.company || '-' }}</span>
            </div>
            <div class="info-item">
              <label>物流单号</label>
              <span>{{ currentOrder.shipping_info.tracking_number || '-' }}</span>
            </div>
            <div class="info-item" v-if="currentOrder.shipped_at">
              <label>发货时间</label>
              <span>{{ formatTime(currentOrder.shipped_at) }}</span>
            </div>
            <div class="info-item" v-if="currentOrder.shipping_info.remarks">
              <label>发货备注</label>
              <span>{{ currentOrder.shipping_info.remarks }}</span>
            </div>
          </div>
        </div>

        <!-- 支付信息（已支付状态） -->
        <div class="detail-section" v-if="['paid', 'confirmed', 'shipped', 'completed'].includes(currentOrder.status)">
          <div class="section-title">支付信息</div>
          <div class="payment-info">
            <div class="info-item" v-if="currentOrder.paid_at">
              <label>支付时间</label>
              <span>{{ formatTime(currentOrder.paid_at) }}</span>
            </div>
            <div class="info-item" v-if="currentOrder.payment_method">
              <label>支付方式</label>
              <span>{{ getPaymentMethodText(currentOrder.payment_method) }}</span>
            </div>
            <div class="info-item" v-if="currentOrder.payment_proof">
              <label>支付凭证</label>
              <el-image
                v-if="currentOrder.payment_proof"
                :src="currentOrder.payment_proof"
                :preview-src-list="[currentOrder.payment_proof]"
                fit="cover"
                class="product-thumb"
                preview-teleported
              />
            </div>
          </div>
        </div>

        <!-- 操作记录 -->
        <div class="detail-section" v-if="currentOrder.operation_history && currentOrder.operation_history.length > 0">
          <div class="section-title">操作记录</div>
          <div class="operation-history">
            <div v-for="(op, index) in currentOrder.operation_history" :key="index" class="operation-item">
              <div class="operation-action">{{ op.action }}</div>
              <div class="operation-detail">{{ op.detail }}</div>
              <div class="operation-time">{{ formatTime(op.created_at) }}</div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <!-- 待支付状态：无操作 -->
          <template v-if="currentOrder.status === 'pending'">
            <el-button type="default" @click="showDetailDialog = false">关闭</el-button>
          </template>

          <!-- 待审核状态：审核通过/拒绝 -->
          <template v-else-if="currentOrder.status === 'paid'">
            <el-button v-if="canEdit" @click="rejectOrder(currentOrder)" :loading="submitting">拒绝</el-button>
            <el-button v-if="canEdit" type="primary" @click="confirmOrder(currentOrder)" :loading="submitting">审核通过</el-button>
          </template>

          <!-- 待发货状态：发货 -->
          <template v-else-if="currentOrder.status === 'confirmed'">
            <el-button type="default" @click="showDetailDialog = false">关闭</el-button>
            <el-button v-if="canEdit" type="primary" @click="shipOrder(currentOrder)">发货</el-button>
          </template>

          <!-- 已发货状态：完成订单 -->
          <template v-else-if="currentOrder.status === 'shipped'">
            <el-button type="default" @click="showDetailDialog = false">关闭</el-button>
            <el-button v-if="canEdit" type="success" @click="completeOrder(currentOrder)">完成订单</el-button>
          </template>

          <!-- 已完成/已取消状态：只显示关闭 -->
          <template v-else>
            <el-button type="primary" @click="showDetailDialog = false">关闭</el-button>
          </template>
        </div>
      </template>
    </MobileDialog>

    <!-- 发货弹窗 -->
    <MobileDialog
      v-model="showShipDialog"
      title="订单发货"
      width="500px"
      dialog-class="h5-order-dialog"
      :show-default-footer="false"
    >
      <el-form :model="shipForm" label-width="100px">
        <el-form-item label="物流公司">
          <el-input v-model="shipForm.shipping_company" placeholder="请输入物流公司名称"/>
        </el-form-item>
        <el-form-item label="物流单号">
          <el-input v-model="shipForm.tracking_number" placeholder="请输入物流单号"/>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="shipForm.remarks" type="textarea" :rows="3" placeholder="请输入备注信息（可选）"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="showShipDialog = false">取消</el-button>
        <el-button v-if="canEdit" type="primary" @click="confirmShip" :loading="submitting">确认发货</el-button>
      </template>
    </MobileDialog>

    <!-- 完成订单弹窗 -->
    <MobileDialog
      v-model="showCompleteDialog"
      title="完成订单"
      width="500px"
      dialog-class="h5-order-dialog"
      :show-default-footer="false"
    >
      <el-form :model="completeForm" label-width="100px">
        <el-form-item label="备注">
          <el-input v-model="completeForm.remarks" type="textarea" :rows="4" placeholder="请输入备注信息（可选）"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="showCompleteDialog = false">取消</el-button>
        <el-button v-if="canEdit" type="success" @click="confirmComplete" :loading="submitting">确认完成</el-button>
      </template>
    </MobileDialog>

    <!-- 取消订单弹窗 -->
    <MobileDialog
      v-model="showCancelDialog"
      title="取消订单"
      width="500px"
      dialog-class="h5-order-dialog"
      :show-default-footer="false"
    >
      <el-form :model="cancelForm" label-width="100px">
        <el-form-item label="取消原因" required>
          <el-input v-model="cancelForm.reason" type="textarea" :rows="4" placeholder="请输入取消原因"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="showCancelDialog = false">取消</el-button>
        <el-button v-if="canEdit" type="danger" @click="confirmCancel" :loading="submitting">确认取消</el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted, onUnmounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { PermissionDenied } from '@/components/base'
import Pagination from '@/components/Pagination.vue'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useLoadingState } from '@/composables'
import { api } from '@/utils/unified-api'
import logger from '@/utils/logger'
import type { HeaderAction } from '@/types'

// 注入父组件提供的注册方法
const registerHeaderActions = inject<(actions: HeaderAction[]) => void>('registerHeaderActions')
const clearHeaderActions = inject<() => void>('clearHeaderActions')

type OrderRecord = Record<string, unknown>
type OrderStatistics = Record<string, unknown>
type OrderDateRange = [string, string] | []

const router = useRouter()
const { canView, canEdit, handleNoPermission } = usePagePermissions('h5-admin-orders')
const H5_ORDER_MODULE_KEY = 'h5_admin_ordersview'

// 数据
const { loading } = useLoadingState()
const orders = ref<OrderRecord[]>([])
const statistics = ref<OrderStatistics>({})
const currentOrder = ref<OrderRecord | null>(null)
const showDetailDialog = ref(false)
const showShipDialog = ref(false)
const showCompleteDialog = ref(false)
const showCancelDialog = ref(false)
const submitting = ref(false)

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 筛选条件
const filters = reactive({
  status: '',
  customer_name: '',
  customer_phone: '',
  order_number: ''
})

const dateRange = ref<OrderDateRange>([])

// 表单数据
const shipForm = reactive({
  shipping_company: '',
  tracking_number: '',
  remarks: ''
})

const completeForm = reactive({
  remarks: ''
})

const cancelForm = reactive({
  reason: ''
})

const orderFieldMap: Record<string, string> = {
  stats_total_orders: 'stats.total_orders',
  stats_pending_orders: 'stats.pending_orders',
  stats_paid_orders: 'stats.paid_orders',
  stats_confirmed_orders: 'stats.confirmed_orders',
  stats_shipped_orders: 'stats.shipped_orders',
  stats_completed_orders: 'stats.completed_orders',
  filter_status: 'filters.status',
  filter_customer_name: 'filters.customer_name',
  filter_customer_phone: 'filters.customer_phone',
  filter_order_number: 'filters.order_number',
  filter_date_range: 'filters.date_range'
}

const canViewOrderField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible(H5_ORDER_MODULE_KEY, orderFieldMap[fieldName] || fieldName)
}

const showStatsCards = computed(() => (
  canViewOrderField('stats_total_orders') ||
  canViewOrderField('stats_pending_orders') ||
  canViewOrderField('stats_paid_orders') ||
  canViewOrderField('stats_confirmed_orders') ||
  canViewOrderField('stats_shipped_orders') ||
  canViewOrderField('stats_completed_orders')
))

const ensureOrderViewPermission = () => {
  if (canView.value) {
    return true
  }

  handleNoPermission('view')
  return false
}

// 获取订单列表
const loadOrders = async () => {
  if (!canView.value) {
    orders.value = []
    pagination.total = 0
    loading.value = false
    return
  }

  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: pagination.page,
      limit: pagination.limit
    }

    if (filters.status) params.status = filters.status
    if (filters.customer_name) params.customer_name = filters.customer_name
    if (filters.customer_phone) params.customer_phone = filters.customer_phone
    if (filters.order_number) params.order_number = filters.order_number
    if (dateRange.value?.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }

    const response = await api.get('/sales-management/h5-orders', { params })
    orders.value = response.data

    // 分页信息在 response.pagination 中
    if (response.pagination) {
      pagination.page = Number(response.pagination.page) || 1
      pagination.limit = Number(response.pagination.limit) || 20
      pagination.total = Number(response.pagination.total) || 0
    }
  } catch (error: any) {
    logger.error('获取订单列表失败', error)
  } finally {
    loading.value = false
  }
}

// 获取统计数据
const loadStatistics = async () => {
  if (!canView.value) {
    statistics.value = {}
    return
  }

  try {
    const params: Record<string, unknown> = {}
    if (dateRange.value?.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }

    const response = await api.get('/sales-management/h5-orders/statistics', { params })
    statistics.value = response.data
  } catch (error: any) {
    logger.error('获取统计数据失败', error)
  }
}

// 筛选条件变化
const handleFilterChange = () => {
  if (!ensureOrderViewPermission()) {
    return
  }

  pagination.page = 1
  loadOrders()
  loadStatistics()
}

// 重置筛选
const resetFilters = () => {
  if (!ensureOrderViewPermission()) {
    return
  }

  filters.status = ''
  filters.customer_name = ''
  filters.customer_phone = ''
  filters.order_number = ''
  dateRange.value = []
  handleFilterChange()
}

// 分页变化处理
const handleSizeChange = (size: number) => {
  if (!ensureOrderViewPermission()) {
    return
  }

  pagination.limit = size
  pagination.page = 1
  loadOrders()
}

const handleCurrentChange = (page: number) => {
  if (!ensureOrderViewPermission()) {
    return
  }

  pagination.page = page
  loadOrders()
}

const handlePaginationChange = (page: number, size: number) => {
  if (size !== pagination.limit) {
    handleSizeChange(size)
    return
  }

  handleCurrentChange(page)
}

// 按状态筛选
const filterByStatus = (status: string) => {
  if (!ensureOrderViewPermission()) {
    return
  }

  filters.status = status
  handleFilterChange()
}

// 获取状态数量
const getStatusCount = (status: string) => {
  const stat = statistics.value.by_status?.find((s: any) => s.status === status)
  return stat?.count || 0
}

// 状态文字
const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '待支付',
    paid: '待审核',
    confirmed: '待发货',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消'
  }
  return texts[status] || '未知状态'
}

// 状态类型
const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    pending: 'warning',
    paid: 'warning',
    confirmed: 'primary',
    shipped: 'info',
    completed: 'success',
    cancelled: 'danger'
  }
  return types[status] || 'info'
}

// 获取状态时间线
const getStatusTimeline = (order: any) => {
  const timeline = [
    { title: '创建订单', time: order.created_at, active: true },
    { title: '支付完成', time: order.paid_at, active: !!order.paid_at },
    { title: '审核通过', time: order.confirmed_at, active: !!order.confirmed_at },
    { title: '已发货', time: order.shipped_at, active: !!order.shipped_at },
    { title: '已完成', time: order.completed_at, active: !!order.completed_at }
  ]

  // 根据当前状态过滤
  if (order.status === 'pending') {
    return timeline.slice(0, 1)
  } else if (order.status === 'paid') {
    return timeline.slice(0, 2)
  } else if (order.status === 'confirmed') {
    return timeline.slice(0, 3)
  } else if (order.status === 'shipped') {
    return timeline.slice(0, 4)
  } else if (order.status === 'completed') {
    return timeline
  } else if (order.status === 'cancelled') {
    return timeline.filter(t => t.active)
  }

  return timeline.filter(t => t.active)
}

// 获取支付方式文本
const getPaymentMethodText = (method: string) => {
  const methods: Record<string, string> = {
    wechat: '微信支付',
    alipay: '支付宝',
    bank: '银行转账'
  }
  return methods[method] || method
}

// 格式化时间
const formatTime = (time: string) => {
  if (!time) return ''
  const date = new Date(time)
  return date.toLocaleString('zh-CN')
}

// 查看订单详情
const viewOrder = async (order: any) => {
  if (!ensureOrderViewPermission()) {
    return
  }

  try {
    const response = await api.get(`/sales-management/h5-orders/${order.id}`)
    currentOrder.value = response.data
    showDetailDialog.value = true
  } catch (error: any) {
    logger.error('获取订单详情失败', error)
    ElMessage.error('获取订单详情失败')
  }
}

// 审核通过
const confirmOrder = async (order: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  try {
    await ElMessageBox.confirm('确认通过该订单的支付审核？通过后将锁定库存。', '确认审核', {
      type: 'warning'
    })

    submitting.value = true
    await api.put(`/sales-management/h5-orders/${order.id}/confirm`, {
      remarks: '后台审核通过'
    })

    ElMessage.success('订单审核通过')
    await loadOrders()
    await loadStatistics()
    showDetailDialog.value = false
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('审核订单失败', error)
    }
  } finally {
    submitting.value = false
  }
}

// 拒绝订单
const rejectOrder = async (order: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  try {
    const { value } = await ElMessageBox.prompt('请输入拒绝原因', '拒绝订单', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '请输入拒绝原因'
    })

    if (!value) return

    submitting.value = true
    await api.put(`/sales-management/h5-orders/${order.id}/reject`, {
      reason: value
    })

    ElMessage.success('订单已拒绝')
    await loadOrders()
    await loadStatistics()
    showDetailDialog.value = false
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('拒绝订单失败', error)
    }
  } finally {
    submitting.value = false
  }
}

// 发货
const shipOrder = (order: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  currentOrder.value = order
  shipForm.shipping_company = ''
  shipForm.tracking_number = ''
  shipForm.remarks = ''
  showShipDialog.value = true
}

// 确认发货
const confirmShip = async () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  if (!shipForm.shipping_company || !shipForm.tracking_number) {
    ElMessage.warning('请填写物流公司和物流单号')
    return
  }

  try {
    submitting.value = true
    await api.put(`/sales-management/h5-orders/${currentOrder.value.id}/ship`, shipForm)

    ElMessage.success('订单发货成功')
    showShipDialog.value = false
    await loadOrders()
    await loadStatistics()
    if (showDetailDialog.value) {
      showDetailDialog.value = false
    }
  } catch (error: any) {
    logger.error('发货失败', error)
  } finally {
    submitting.value = false
  }
}

// 完成订单
const completeOrder = (order: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  currentOrder.value = order
  completeForm.remarks = ''
  showCompleteDialog.value = true
}

// 确认完成
const confirmComplete = async () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  try {
    submitting.value = true
    await api.put(`/sales-management/h5-orders/${currentOrder.value.id}/complete`, {
      remarks: completeForm.remarks
    })

    ElMessage.success('订单已完成')
    showCompleteDialog.value = false
    await loadOrders()
    await loadStatistics()
    if (showDetailDialog.value) {
      showDetailDialog.value = false
    }
  } catch (error: any) {
    logger.error('完成订单失败', error)
  } finally {
    submitting.value = false
  }
}

// 取消订单
const cancelOrder = (order: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  currentOrder.value = order
  cancelForm.reason = ''
  showCancelDialog.value = true
}

// 确认取消
const confirmCancel = async () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  if (!cancelForm.reason) {
    ElMessage.warning('请输入取消原因')
    return
  }

  try {
    submitting.value = true
    await api.put(`/sales-management/h5-orders/${currentOrder.value.id}/cancel`, {
      reason: cancelForm.reason
    })

    ElMessage.success('订单已取消')
    showCancelDialog.value = false
    await loadOrders()
    await loadStatistics()
    if (showDetailDialog.value) {
      showDetailDialog.value = false
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('取消订单失败', error)
    }
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (canView.value) {
    await fieldPermissions.init()
    loadOrders()
    loadStatistics()
  }
  // 注册头部操作按钮
  if (registerHeaderActions) {
    registerHeaderActions([
      {
        label: '刷新',
        type: 'default',
        icon: Refresh,
        disabled: () => loading.value,
        handler: () => loadOrders()
      }
    ])
  }
})

onUnmounted(() => {
  if (clearHeaderActions) {
    clearHeaderActions()
  }
})
</script>

<style scoped lang="scss">
.sales-management-page {
  padding: 20px;
}

// 统计卡片
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;

  .stat-card {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transition: all 0.3s;

    &:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      transform: translateY(-2px);
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 24px;

      i {
        font-size: 24px;
      }
    }

    .stat-content {
      flex: 1;

      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: #333;
        line-height: 1;
      }

      .stat-label {
        font-size: 13px;
        color: #999;
        margin-top: 4px;
      }
    }
  }
}

// 筛选卡片
.filter-card {
  margin-bottom: 16px;
}

.filter-form {
  .el-form-item {
    margin-bottom: 0;
  }
}

// 表格卡片
.table-card {
  .amount {
    font-weight: 600;
    color: #ff1744;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .pagination-wrapper {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}

// 订单详情
.order-detail {
  .detail-section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
    }

    .status-info {
      display: flex;
      align-items: center;
      gap: 16px;

      .order-time {
        font-size: 13px;
        color: #999;
      }
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 4px;

        &.full-width {
          grid-column: 1 / -1;
        }

        label {
          font-size: 13px;
          color: #999;
        }

        span {
          font-size: 14px;
          color: #333;
        }
      }
    }
  }

  .order-items {
    .order-item {
      display: grid;
      grid-template-columns: 3fr 1fr 1fr 1fr;
      gap: 12px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
      align-items: center;

      .item-info {
        .item-name {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .item-specs {
          font-size: 12px;
          color: #999;
          margin-top: 2px;
        }
      }

      .item-quantity {
        font-size: 14px;
        color: #666;
      }

      .item-price {
        font-size: 14px;
        color: #666;
      }

      .item-subtotal {
        font-size: 14px;
        font-weight: 600;
        color: #ff1744;
      }
    }
  }

  .price-summary {
    .price-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
      color: #666;

      &.total {
        border-top: 1px solid #eee;
        padding-top: 12px;
        margin-top: 8px;
        font-size: 16px;
        font-weight: 500;

        .total-amount {
          font-size: 20px;
          font-weight: 600;
          color: #ff1744;
        }
      }
    }
  }

  // 状态时间线
  .status-timeline {
    margin-top: 16px;
    padding-left: 20px;
    position: relative;

    .timeline-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 16px;
      position: relative;

      &:last-child {
        margin-bottom: 0;
      }

      .timeline-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #e0e0e0;
        position: absolute;
        left: -25px;
        top: 4px;

        &.active {
          background: #409eff;
          box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.2);
        }
      }

      .timeline-content {
        flex: 1;

        .timeline-title {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .timeline-time {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }
      }
    }
  }

  // 物流信息
  .shipping-info,
  .payment-info {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;

      &.full-width {
        grid-column: 1 / -1;
      }

      label {
        font-size: 12px;
        color: #999;
      }

      span {
        font-size: 14px;
        color: #333;
      }
    }
  }

  // 操作记录
  .operation-history {
    .operation-item {
      padding: 12px;
      border-radius: 8px;
      background: #f5f5f5;
      margin-bottom: 8px;

      &:last-child {
        margin-bottom: 0;
      }

      .operation-action {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin-bottom: 4px;
      }

      .operation-detail {
        font-size: 13px;
        color: #666;
        margin-bottom: 4px;
      }

      .operation-time {
        font-size: 12px;
        color: #999;
      }
    }
  }

  // 弹窗底部按钮
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .sales-management-page {
    padding: 12px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;

    .stat-card {
      padding: 16px;

      .stat-icon {
        width: 48px;
        height: 48px;
        font-size: 20px;
      }

      .stat-content {
        .stat-value {
          font-size: 20px;
        }

        .stat-label {
          font-size: 12px;
        }
      }
    }
  }

  .filter-form {
    .el-form-item {
      display: block;
      margin-right: 0;
      margin-bottom: 12px;

      .el-form-item__label {
        width: 100% !important;
        text-align: left;
      }

      .el-input,
      .el-select {
        width: 100% !important;
      }
    }
  }

  .table-card {
    // 移动端表格样式优化
    :deep(.el-table) {
      font-size: 12px;

      .el-table__header th {
        padding: 8px 4px;
      }

      .el-table__body td {
        padding: 8px 4px;
      }
    }

    .action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;

      .el-button {
        font-size: 12px;
        padding: 4px 8px;
      }
    }
  }

  .order-detail {
    .detail-section {
      margin-bottom: 16px;
    }

    .info-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .shipping-info,
    .payment-info {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .status-timeline {
      padding-left: 15px;

      .timeline-item {
        .timeline-dot {
          width: 10px;
          height: 10px;
          left: -20px;
        }
      }
    }

    .dialog-footer {
      flex-direction: column;

      .el-button {
        width: 100%;
      }
    }
  }

  // 弹窗移动端优化
  :deep(.el-dialog) {
    width: 95% !important;
    margin: 0 auto;
  }
}
</style>
