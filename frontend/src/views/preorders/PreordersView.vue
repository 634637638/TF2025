<template>
  <PermissionDenied
    v-if="!canView"
    :can-view="canView"
    module-key="preorders"
    module-name="预定管理"
    permission-code="preorders:view"
  />

  <div v-else class="preorders-view">
    <!-- 页面标题 -->
    <PageHeader title="预定管理">
      <template #actions>
        <el-button @click="handleRefresh" :loading="loading">
          <i class="fas fa-sync-alt"></i>
          刷新
        </el-button>
      </template>
    </PageHeader>

    <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <el-card v-if="canViewPreorderField('stats_pending_count')" class="stat-card">
        <div class="stat-content">
          <div class="stat-icon pending">
            <i class="fas fa-clock"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.pending_count }}</div>
            <div class="stat-label">待匹配</div>
          </div>
        </div>
      </el-card>
      <el-card v-if="canViewPreorderField('stats_matched_count')" class="stat-card">
        <div class="stat-content">
          <div class="stat-icon matched">
            <i class="fas fa-link"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.matched_count }}</div>
            <div class="stat-label">已匹配</div>
          </div>
        </div>
      </el-card>
      <el-card v-if="canViewPreorderField('stats_delivered_count')" class="stat-card">
        <div class="stat-content">
          <div class="stat-icon delivered">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.delivered_count }}</div>
            <div class="stat-label">已交付</div>
          </div>
        </div>
      </el-card>
      <el-card v-if="canViewPreorderField('stats_cancelled_count')" class="stat-card">
        <div class="stat-content">
          <div class="stat-icon cancelled">
            <i class="fas fa-times-circle"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.cancelled_count }}</div>
            <div class="stat-label">已取消</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- TAB切换 -->
    <el-tabs v-model="activeTab" class="preorders-tabs" @tab-change="handleTabChange">
      <!-- TAB 1: 新增预定 -->
      <el-tab-pane label="新增预定" name="new">
        <div class="tab-content">
          <div class="actions-bar">
            <el-button v-if="canCreate" type="primary" @click="openCreateModal">
              <i class="fas fa-plus"></i>
              新建预定单
            </el-button>
          </div>

          <!-- 待匹配预定单列表 -->
          <el-table
            ref="pendingTableRef"
            :data="pendingPreorders"
            v-loading="loading"
            stripe
            class="preorders-table"
            @row-dblclick="handleRowDblClick"
            :row-key="(row: Preorder) => String(row.id)"
            :expand-row-keys="expandedRows"
          >
            <el-table-column v-if="isMobile" type="expand" width="1">
              <template #default="{ row }">
                <div class="mobile-row-actions">
                  <el-button
                    v-if="canEdit"
                    type="primary"
                    size="small"
                    @click.stop="editPreorder(row)"
                  >
                    <i class="fas fa-edit"></i>
                    <span>编辑</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    type="danger"
                    size="small"
                    @click.stop="cancelPreorder(row)"
                  >
                    <i class="fas fa-times"></i>
                    <span>取消</span>
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="preorder_number" label="预定单号" min-width="150" />
            <el-table-column label="供应商" min-width="100">
              <template #default="{ row }">
                <span :class="getStatusClass(row.status)">
                  {{ getStatusText(row.status, row.supplier_name) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="store_name" label="店铺" min-width="80" />
            <el-table-column prop="customer_name" label="客户姓名" min-width="90" />
            <el-table-column prop="customer_phone" label="客户电话" min-width="110" />
            <el-table-column label="品牌" min-width="90">
              <template #default="{ row }">
                {{ row.brand_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="型号" min-width="110">
              <template #default="{ row }">
                {{ row.model_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="颜色" min-width="70">
              <template #default="{ row }">
                {{ row.color_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="内存" min-width="70">
              <template #default="{ row }">
                {{ row.memory_size || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="机况" min-width="70">
              <template #default="{ row }">
                <el-tag :type="Number(row.is_new) === 1 ? 'success' : 'info'" size="small">
                  {{ Number(row.is_new) === 1 ? '全新' : '二手' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="advance_payment" label="定金" min-width="80" align="right">
              <template #default="{ row }">
                ¥{{ formatNumber(row.advance_payment) }}
              </template>
            </el-table-column>
            <el-table-column label="销售价格" min-width="90" align="right">
              <template #default="{ row }">
                {{ row.expected_price ? '¥' + formatNumber(row.expected_price) : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="预定时间" min-width="140">
              <template #default="{ row }">
                {{ formatDateTime(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column v-if="!isMobile" label="操作" width="180" fixed="right" align="center" class-name="operation-column">
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-button
                    v-if="canEdit"
                    type="primary"
                    size="small"
                    @click="editPreorder(row)"
                  >
                    <i class="fas fa-edit"></i>
                    编辑
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    type="danger"
                    size="small"
                    @click="cancelPreorder(row)"
                  >
                    <i class="fas fa-times"></i>
                    取消
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <div class="pagination-container">
            <Pagination
              v-model:current="pagination.page"
              v-model:page-size="pagination.limit"
              :total="pagination.total"
              :page-sizes="[10, 20, 50, 100]"
              :show-range="true"
              @change="loadPendingPreorders"
            />
          </div>
        </div>
      </el-tab-pane>

      <!-- TAB 2: 已预定（包含已取消） -->
      <el-tab-pane label="已预定" name="matched">
        <div class="tab-content">
          <div class="filter-bar">
            <el-radio-group v-model="matchedStatus" @change="loadMatchedPreorders">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button value="matched">已匹配</el-radio-button>
              <el-radio-button value="cancelled">已取消</el-radio-button>
            </el-radio-group>
          </div>

          <el-table
            ref="matchedTableRef"
            :data="matchedPreorders"
            v-loading="loading"
            stripe
            class="preorders-table"
            @row-dblclick="handleRowDblClick"
            :row-key="(row: Preorder) => String(row.id)"
            :expand-row-keys="expandedRows"
          >
            <el-table-column v-if="isMobile" type="expand" width="1">
              <template #default="{ row }">
                <div class="mobile-row-actions">
                  <!-- 待匹配状态：编辑、取消 -->
                  <template v-if="row.status === 'pending'">
                    <el-button
                      v-if="canEdit"
                      type="primary"
                      size="small"
                      @click.stop="editMatchedPreorder(row)"
                    >
                      <i class="fas fa-edit"></i>
                      <span>编辑</span>
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="danger"
                      size="small"
                      @click.stop="cancelMatchedPreorder(row)"
                    >
                      <i class="fas fa-times"></i>
                      <span>取消</span>
                    </el-button>
                  </template>
                  <!-- 已匹配状态：交付、编辑、取消 -->
                  <template v-if="row.status === 'arrived'">
                    <el-button
                      v-if="canEdit"
                      type="success"
                      size="small"
                      @click.stop="deliverPreorder(row)"
                    >
                      <i class="fas fa-check"></i>
                      <span>交付</span>
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="primary"
                      size="small"
                      @click.stop="editMatchedPreorder(row)"
                    >
                      <i class="fas fa-edit"></i>
                      <span>编辑</span>
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="danger"
                      size="small"
                      @click.stop="cancelMatchedPreorder(row)"
                    >
                      <i class="fas fa-times"></i>
                      <span>取消</span>
                    </el-button>
                  </template>
                  <!-- 已取消状态：删除、恢复 -->
                  <template v-if="row.status === 'cancelled'">
                    <el-button
                      v-if="canEdit"
                      type="warning"
                      size="small"
                      @click.stop="restorePreorder(row)"
                    >
                      <i class="fas fa-undo"></i>
                      <span>恢复</span>
                    </el-button>
                    <el-button
                      v-if="canDelete"
                      type="danger"
                      size="small"
                      @click.stop="deletePreorder(row)"
                    >
                      <i class="fas fa-trash"></i>
                      <span>删除</span>
                    </el-button>
                  </template>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="preorder_number" label="预定单号" min-width="150" />
            <el-table-column label="供应商" min-width="100">
              <template #default="{ row }">
                <span :class="getStatusClass(row.status)">
                  {{ getStatusText(row.status, row.supplier_name) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="store_name" label="店铺" min-width="80" />
            <el-table-column prop="customer_name" label="客户姓名" min-width="90" />
            <el-table-column prop="customer_phone" label="客户电话" min-width="110" />
            <el-table-column label="品牌" min-width="90">
              <template #default="{ row }">
                {{ row.brand_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="型号" min-width="110">
              <template #default="{ row }">
                {{ row.model_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="颜色" min-width="70">
              <template #default="{ row }">
                {{ row.color_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="内存" min-width="70">
              <template #default="{ row }">
                {{ row.memory_size || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="机况" min-width="70">
              <template #default="{ row }">
                <el-tag :type="Number(row.is_new) === 1 ? 'success' : 'info'" size="small">
                  {{ Number(row.is_new) === 1 ? '全新' : '二手' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="imei" label="IMEI" min-width="130">
              <template #default="{ row }">
                <span :class="getStatusClass(row.status)">
                  {{ getStatusText(row.status, row.imei) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="advance_payment" label="定金" min-width="80" align="right">
              <template #default="{ row }">
                ¥{{ formatNumber(row.advance_payment) }}
              </template>
            </el-table-column>
            <el-table-column label="销售价格" min-width="90" align="right">
              <template #default="{ row }">
                {{ row.expected_price ? '¥' + formatNumber(row.expected_price) : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="status_text" label="状态" min-width="80">
              <template #default="{ row }">
                <el-tag :type="getStatusTagType(row.status)">
                  {{ row.status_text }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="matched_time" label="匹配时间" min-width="140">
              <template #default="{ row }">
                <span :class="getStatusClass(row.status)">
                  {{ getMatchedTimeText(row) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column v-if="!isMobile" label="操作" width="300" fixed="right" align="center">
              <template #default="{ row }">
                <div class="action-buttons">
                  <!-- 待匹配状态：编辑、取消 -->
                  <template v-if="row.status === 'pending'">
                    <el-button
                      v-if="canEdit"
                      type="primary"
                      size="small"
                      @click="editMatchedPreorder(row)"
                    >
                      <i class="fas fa-edit"></i>
                      编辑
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="danger"
                      size="small"
                      @click="cancelMatchedPreorder(row)"
                    >
                      <i class="fas fa-times"></i>
                      取消
                    </el-button>
                  </template>
                  <!-- 已匹配状态：交付、编辑、取消 -->
                  <template v-if="row.status === 'arrived'">
                    <el-button
                      v-if="canEdit"
                      type="success"
                      size="small"
                      @click="deliverPreorder(row)"
                    >
                      <i class="fas fa-check"></i>
                      交付
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="primary"
                      size="small"
                      @click="editMatchedPreorder(row)"
                    >
                      <i class="fas fa-edit"></i>
                      编辑
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="danger"
                      size="small"
                      @click="cancelMatchedPreorder(row)"
                    >
                      <i class="fas fa-times"></i>
                      取消
                    </el-button>
                  </template>
                  <!-- 已取消状态：删除、恢复 -->
                  <template v-if="row.status === 'cancelled'">
                    <el-button
                      v-if="canEdit"
                      type="warning"
                      size="small"
                      @click="restorePreorder(row)"
                    >
                      <i class="fas fa-undo"></i>
                      恢复
                    </el-button>
                    <el-button
                      v-if="canDelete"
                      type="danger"
                      size="small"
                      @click="deletePreorder(row)"
                    >
                      <i class="fas fa-trash"></i>
                      删除
                    </el-button>
                  </template>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <div class="pagination-container">
            <Pagination
              v-model:current="pagination.page"
              v-model:page-size="pagination.limit"
              :total="pagination.total"
              :page-sizes="[10, 20, 50, 100]"
              :show-range="true"
              @change="loadMatchedPreorders"
            />
          </div>
        </div>
      </el-tab-pane>

      <!-- TAB 3: 已交付 -->
      <el-tab-pane label="已交付" name="delivered">
        <div class="tab-content">
          <el-table
            ref="deliveredTableRef"
            :data="deliveredPreorders"
            v-loading="loading"
            stripe
            class="preorders-table"
            @row-dblclick="handleRowDblClick"
            :row-key="(row: Preorder) => String(row.id)"
            :expand-row-keys="expandedRows"
          >
            <el-table-column v-if="isMobile" type="expand" width="1">
              <template #default="{ row }">
                <div class="mobile-row-actions">
                  <el-button
                    v-if="canDelete"
                    type="danger"
                    size="small"
                    @click.stop="deletePreorder(row)"
                  >
                    <i class="fas fa-trash"></i>
                    <span>删除</span>
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="preorder_number" label="预定单号" min-width="140" />
            <el-table-column label="供应商" min-width="100">
              <template #default="{ row }">
                <span :class="getStatusClass(row.status)">
                  {{ getStatusText(row.status, row.supplier_name) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="store_name" label="店铺" min-width="80" />
            <el-table-column prop="customer_name" label="客户姓名" min-width="85" />
            <el-table-column prop="customer_phone" label="客户电话" min-width="105" />
            <el-table-column label="品牌" min-width="85">
              <template #default="{ row }">
                {{ row.brand_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="型号" min-width="100">
              <template #default="{ row }">
                {{ row.model_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="颜色" min-width="65">
              <template #default="{ row }">
                {{ row.color_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="内存" min-width="65">
              <template #default="{ row }">
                {{ row.memory_size || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="机况" min-width="70">
              <template #default="{ row }">
                <el-tag :type="Number(row.is_new) === 1 ? 'success' : 'info'" size="small">
                  {{ Number(row.is_new) === 1 ? '全新' : '二手' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="imei" label="IMEI" min-width="125" />
            <el-table-column prop="advance_payment" label="定金" min-width="75" align="right">
              <template #default="{ row }">
                ¥{{ formatNumber(row.advance_payment) }}
              </template>
            </el-table-column>
            <el-table-column prop="actual_price" label="销售价格" min-width="85" align="right">
              <template #default="{ row }">
                ¥{{ formatNumber(row.actual_price) }}
              </template>
            </el-table-column>
            <el-table-column prop="remaining_amount" label="尾款" min-width="75" align="right">
              <template #default="{ row }">
                ¥{{ formatNumber(row.remaining_amount || 0) }}
              </template>
            </el-table-column>
            <el-table-column prop="delivered_time" label="交付时间" min-width="140">
              <template #default="{ row }">
                {{ row.delivered_time ? formatDateTime(row.delivered_time) : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="operator_name" label="操作员" min-width="85" />
            <el-table-column v-if="!isMobile" label="操作" width="100" fixed="right" align="center">
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-button
                    v-if="canDelete"
                    type="danger"
                    size="small"
                    @click="deletePreorder(row)"
                  >
                    <i class="fas fa-trash"></i>
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <div class="pagination-container">
            <Pagination
              v-model:current="pagination.page"
              v-model:page-size="pagination.limit"
              :total="pagination.total"
              :page-sizes="[10, 20, 50, 100]"
              :show-range="true"
              @change="loadDeliveredPreorders"
            />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 预定单表单模态框（创建/编辑） -->
    <PreorderFormModal
      v-model:visible="showFormModal"
      :mode="formModalMode"
      :preorder="selectedPreorder"
      @success="handlePreorderFormSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useLoadingState } from '@/composables'
import { preorderApi, Preorder, PreorderStatus } from '@/api/preorder'
import { PageHeader, PermissionDenied } from '@/components/base'
import Pagination from '@/components/Pagination.vue'
import PreorderFormModal from './page/PreorderFormModal.vue'
import { logger } from '@/utils/logger'

const { success, error, warning } = useNotification()
const {
  canView,
  canCreate,
  canEdit,
  canDelete,
  handleNoPermission
} = usePagePermissions('preorders')
const router = useRouter()

// 表格引用
const pendingTableRef = ref()
const matchedTableRef = ref()
const deliveredTableRef = ref()

// 当前展开的行
const expandedRows = ref<string[]>([])

const preorderFieldMap: Record<string, string> = {
  stats_pending_count: 'stats.pending_count',
  stats_matched_count: 'stats.matched_count',
  stats_delivered_count: 'stats.delivered_count',
  stats_cancelled_count: 'stats.cancelled_count',
  actions: 'system_info.operations'
}

const getPreorderFieldKey = (fieldName: string) => preorderFieldMap[fieldName] || fieldName
const canViewPreorderField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('preorders_preordersview', getPreorderFieldKey(fieldName))
}

const showStatsCards = computed(() => (
  canViewPreorderField('stats_pending_count') ||
  canViewPreorderField('stats_matched_count') ||
  canViewPreorderField('stats_delivered_count') ||
  canViewPreorderField('stats_cancelled_count')
))

// 状态
const activeTab = ref('new')
const { loading } = useLoadingState()
const matchedStatus = ref('all')
const isMobile = ref(window.innerWidth <= 768)

// 监听窗口大小变化
const handleResize = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

// 统计数据
const stats = reactive({
  total: 0,
  pending_count: 0,
  matched_count: 0,
  delivered_count: 0,
  cancelled_count: 0,
  total_deposits: 0,
  total_sales_value: 0
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 列表数据
const pendingPreorders = ref<Preorder[]>([])
const matchedPreorders = ref<Preorder[]>([])
const deliveredPreorders = ref<Preorder[]>([])

// 模态框状态
const showFormModal = ref(false)
const formModalMode = ref<'create' | 'edit'>('create')
const selectedPreorder = ref<Preorder | null>(null)

// 加载统计数据
const loadStats = async () => {
  try {
    const data = await preorderApi.getPreorderStats()
    Object.assign(stats, data)
  } catch (err) {
    logger.error('获取统计失败:', err)
  }
}

// 加载待匹配预定单
const loadPendingPreorders = async () => {
  loading.value = true
  try {
    const data = await preorderApi.getPreorders({
      page: pagination.page,
      limit: pagination.limit,
      status: PreorderStatus.PENDING
    })
    pendingPreorders.value = data.records
    pagination.total = data.pagination.total
  } catch (err) {
    error('加载待匹配预定单失败')
  } finally {
    loading.value = false
  }
}

// 加载已匹配预定单（包含待匹配、已匹配、已取消）
const loadMatchedPreorders = async () => {
  loading.value = true
  try {
    // 根据筛选状态加载不同数据
    // 'all' - 加载全部（待匹配、已匹配、已取消）
    // 'matched' - 只加载已匹配（arrived）
    // 'cancelled' - 只加载已取消
    let status: PreorderStatus | undefined
    if (matchedStatus.value === 'matched') {
      status = PreorderStatus.MATCHED  // arrived
    } else if (matchedStatus.value === 'cancelled') {
      status = PreorderStatus.CANCELLED
    }
    // 'all' 时传 undefined，后端返回所有数据

    const data = await preorderApi.getPreorders({
      page: pagination.page,
      limit: pagination.limit,
      status
    })
    matchedPreorders.value = data.records
    pagination.total = data.pagination.total
  } catch (err) {
    error('加载已匹配预定单失败')
  } finally {
    loading.value = false
  }
}

// 加载已交付预定单
const loadDeliveredPreorders = async () => {
  loading.value = true
  try {
    const data = await preorderApi.getPreorders({
      page: pagination.page,
      limit: pagination.limit,
      status: PreorderStatus.DELIVERED
    })
    deliveredPreorders.value = data.records
    pagination.total = data.pagination.total
  } catch (err) {
    error('加载已交付预定单失败')
  } finally {
    loading.value = false
  }
}

// TAB切换
const handleTabChange = (tabName: string) => {
  pagination.page = 1
  if (tabName === 'new') {
    loadPendingPreorders()
  } else if (tabName === 'matched') {
    loadMatchedPreorders()
  } else if (tabName === 'delivered') {
    loadDeliveredPreorders()
  }
}

// 打开创建模态框
const openCreateModal = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }
  formModalMode.value = 'create'
  selectedPreorder.value = null
  showFormModal.value = true
}

// 刷新数据
const handleRefresh = async () => {
  loading.value = true
  try {
    await loadStats()
    handleTabChange(activeTab.value)
    success('刷新成功')
  } finally {
    loading.value = false
  }
}

// 双击行处理
const handleRowDblClick = (row: Preorder) => {
  if (isMobile.value) {
    const rowKey = String(row.id)
    const index = expandedRows.value.indexOf(rowKey)
    if (index > -1) {
      // 如果已展开，则收起
      expandedRows.value.splice(index, 1)
    } else {
      // 如果未展开，则展开（只保留当前行）
      expandedRows.value = [rowKey]
    }
  }
}

// 编辑预定单
const editPreorder = (preorder: Preorder) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
  formModalMode.value = 'edit'
  selectedPreorder.value = preorder
  showFormModal.value = true
}

// 取消预定单
const cancelPreorder = async (preorder: Preorder) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  try {
    const { value: reason } = await ElMessageBox.prompt('请输入取消原因', '取消预定单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '请输入取消原因'
    })

    await preorderApi.cancelPreorder(preorder.id, reason)
    success('预定单已取消')
    loadPendingPreorders()
    loadStats()
  } catch (err: any) {
    if (err !== 'cancel') {
      error('取消预定单失败')
    }
  }
}

// 交付预定单 - 跳转到销售页面
const deliverPreorder = (preorder: Preorder) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  // 检查是否有匹配的IMEI
  if (!preorder.imei) {
    warning('该预定单尚未匹配设备，无法交付')
    return
  }

  // 跳转到销售页面，携带IMEI和预定单信息
  router.push({
    path: '/sales',
    query: {
      imei: preorder.imei,
      preorder_id: preorder.id,
      customer_id: preorder.customer_id,
      customer_name: preorder.customer_name,
      customer_phone: preorder.customer_phone,
      expected_price: preorder.expected_price || preorder.advance_payment || '',
      advance_payment: preorder.advance_payment
    }
  })
}

// 编辑已匹配的预定单
const editMatchedPreorder = (preorder: Preorder) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
  formModalMode.value = 'edit'
  selectedPreorder.value = preorder
  showFormModal.value = true
}

// 取消已匹配的预定单
const cancelMatchedPreorder = async (preorder: Preorder) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  try {
    const { value: reason } = await ElMessageBox.prompt('请输入取消原因', '取消预定单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '请输入取消原因'
    })

    await preorderApi.cancelPreorder(preorder.id, reason)
    success('预定单已取消')
    loadMatchedPreorders()
    loadStats()
  } catch (err: any) {
    if (err !== 'cancel') {
      error('取消预定单失败')
    }
  }
}

// 恢复已取消的预定单
const restorePreorder = async (preorder: Preorder) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  try {
    await ElMessageBox.confirm('确定要恢复此预定单吗？恢复后将变为待匹配状态。', '恢复预定单', {
      confirmButtonText: '确定恢复',
      cancelButtonText: '取消',
      type: 'info'
    })

    // 调用专门的恢复API
    await preorderApi.restorePreorder(preorder.id)
    success('预定单已恢复')
    loadMatchedPreorders()
    loadStats()
  } catch (err: any) {
    if (err !== 'cancel') {
      error('恢复预定单失败')
    }
  }
}

// 删除预定单
const deletePreorder = async (preorder: Preorder) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm('确定要删除此预定单吗？删除后将无法恢复！', '删除预定单', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    })

    await preorderApi.deletePreorder(preorder.id)
    success('预定单已删除')

    // 根据当前标签页重新加载数据
    if (activeTab.value === 'matched') {
      loadMatchedPreorders()
    } else if (activeTab.value === 'delivered') {
      loadDeliveredPreorders()
    }

    loadStats()
  } catch (err: any) {
    if (err !== 'cancel') {
      error('删除预定单失败')
    }
  }
}

// 预定单表单提交成功
const handlePreorderFormSuccess = () => {
  showFormModal.value = false
  if (formModalMode.value === 'create') {
    success('预定单创建成功')
    loadPendingPreorders()
    loadStats()
  } else {
    success('预定单更新成功')
    if (activeTab.value === 'matched') {
      loadMatchedPreorders()
    } else if (activeTab.value === 'delivered') {
      loadDeliveredPreorders()
    } else {
      loadPendingPreorders()
    }
    loadStats()
  }
}

// 格式化数字
const formatNumber = (num: number | string | null | undefined) => {
  if (num === null || num === undefined) return '0.00'
  const number = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(number)) return '0.00'
  return number.toFixed(2)
}

// 格式化日期时间（只显示年月日）
const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// 获取状态标签类型
const getStatusTagType = (status: PreorderStatus) => {
  const typeMap: Record<PreorderStatus, any> = {
    [PreorderStatus.PENDING]: 'warning',
    [PreorderStatus.MATCHED]: 'primary',
    [PreorderStatus.DELIVERED]: 'success',
    [PreorderStatus.CANCELLED]: 'danger'
  }
  return typeMap[status] || ''
}

// 获取状态对应的CSS类名
const getStatusClass = (status: string) => {
  const classMap: Record<string, string> = {
    'pending': 'status-pending',
    'arrived': 'status-matched',
    'completed': 'status-delivered',
    'cancelled': 'status-cancelled'
  }
  return classMap[status] || ''
}

// 根据状态获取显示文本（供应商、IMEI）
const getStatusText = (status: string, value?: string) => {
  if (status === 'cancelled') {
    return '已取消'
  }
  if (status === 'pending') {
    return '待匹配'
  }
  return value || '待匹配'
}

// 根据状态获取匹配时间显示文本
const getMatchedTimeText = (row: Preorder) => {
  if (row.status === 'cancelled') {
    return '已取消'
  }
  if (row.status === 'pending') {
    return '待匹配'
  }
  return row.matched_time ? formatDateTime(row.matched_time) : '待匹配'
}

// 初始化
onMounted(async () => {
  if (!canView.value) {
    return
  }

  await fieldPermissions.init()
  loadStats()
  loadPendingPreorders()
})
</script>

<!-- 全局表格样式已在 src/styles/components/_table.scss 中定义 -->
<style scoped lang="scss">
.preorders-view {
  padding: 20px;

  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;

    .stat-card {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
      }

      &:nth-child(1)::before {
        background: linear-gradient(90deg, #fa8c16, #ffa940);
      }

      &:nth-child(2)::before {
        background: linear-gradient(90deg, #1890ff, #40a9ff);
      }

      &:nth-child(3)::before {
        background: linear-gradient(90deg, #52c41a, #73d13d);
      }

      &:nth-child(4)::before {
        background: linear-gradient(90deg, #f5222d, #ff4d4f);
      }

      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
      }

      .stat-content {
        display: flex;
        align-items: center;
        gap: 16px;

        .stat-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;

          &.pending {
            background: linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%);
            color: #fa8c16;
          }

          &.matched {
            background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%);
            color: #1890ff;
          }

          &.delivered {
            background: linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%);
            color: #52c41a;
          }

          &.cancelled {
            background: linear-gradient(135deg, #fff1f0 0%, #ffccc7 100%);
            color: #f5222d;
          }
        }

        .stat-info {
          flex: 1;

          .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #303133;
            line-height: 1.2;
            margin-bottom: 4px;
          }

          .stat-label {
            font-size: 14px;
            color: #909399;
            font-weight: 500;
          }
        }
      }
    }
  }

  .preorders-tabs {
    :deep(.el-tabs__header) {
      background: #fff;
      border-radius: 8px 8px 0 0;
      padding: 0 20px;
      margin-bottom: 0;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    :deep(.el-tabs__nav-wrap::after) {
      display: none;
    }

    :deep(.el-tabs__item) {
      font-size: 15px;
      font-weight: 500;
      color: #606266;
      padding: 0 20px;
      height: 48px;
      line-height: 48px;

      &.is-active {
        color: #409eff;
        font-weight: 600;
      }
    }

    .tab-content {
      background: #fff;
      border-radius: 0 0 8px 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

      .actions-bar,
      .filter-bar {
        margin-bottom: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 12px;
        border-bottom: 1px solid #ebeef5;
      }

      .pagination-container {
        display: flex;
        justify-content: flex-end;
        padding-top: 16px;
        border-top: 1px solid #ebeef5;
      }

      // 操作按钮容器样式
      .action-buttons {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        padding: 0 4px;

        .el-button {
          padding: 6px 12px;
          min-width: 70px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          white-space: nowrap;

          i {
            font-size: 14px;
          }
        }
      }

      // 修复表格固定列按钮被遮挡的问题
      :deep(.el-table) {
        .el-table__fixed,
        .el-table__fixed-right {
          z-index: 2 !important;

          .cell {
            overflow: visible !important;
          }
        }

        .el-table__fixed-right {
          right: 0 !important;
          box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1) !important;
        }

        .el-table__fixed-right::before {
          content: '';
          position: absolute;
          top: 0;
          left: -1px;
          bottom: 0;
          width: 1px;
          background: #ebeef5;
        }

        .el-table__body-wrapper {
          overflow-x: auto !important;
        }
      }

      // 修复操作列按钮显示
      :deep(.el-table__fixed-right) {
        .el-button {
          position: relative;
          z-index: 10;
        }
      }
    }
  }

  // 状态颜色样式
  .status-pending {
    color: #e6a23c;
    font-weight: 500;
  }

  .status-matched {
    color: #409eff;
    font-weight: 500;
  }

  .status-delivered {
    color: #67c23a;
    font-weight: 500;
  }

  .status-cancelled {
    color: #f56c6c;
    font-weight: 500;
  }

  // 手机端响应式样式
  @media (max-width: 768px) {
    padding: 8px;

    // 手机端操作行样式
    .mobile-row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 4px;

      .el-button {
        flex: 1;
        min-width: calc(50% - 4px);
        margin: 0;

        span {
          margin-left: 4px;
        }
      }
    }

    // 展开列样式
    :deep(.el-table__expand-column) {
      .cell {
        padding: 0 !important;
      }
    }

    .stats-cards {
      gap: 8px;
      margin-bottom: 16px;
      grid-template-columns: repeat(2, 1fr);

      .stat-card {
        padding: 12px;
        min-height: 80px;

        :deep(.el-card__body) {
          padding: 0;
        }

        .stat-content {
          gap: 10px;

          .stat-icon {
            width: 40px;
            height: 40px;
            font-size: 18px;
          }

          .stat-info {
            .stat-value {
              font-size: 20px;
            }

            .stat-label {
              font-size: 12px;
            }
          }
        }
      }
    }

    .preorders-tabs {
      :deep(.el-tabs__header) {
        padding: 0 12px;
      }

      :deep(.el-tabs__item) {
        font-size: 13px;
        padding: 0 12px;
        height: 42px;
        line-height: 42px;
      }

      .tab-content {
        padding: 12px;

        .actions-bar,
        .filter-bar {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;

          .el-button {
            width: 100%;
          }
        }
      }
    }

    .preorders-table {
      font-size: 12px;

      :deep(.el-table__header) th {
        padding: 8px 4px;
        font-size: 12px;
      }

      :deep(.el-table__body) td {
        padding: 8px 4px;
        font-size: 12px;
      }
    }

    .pagination-container {
      :deep(.el-pagination) {
        justify-content: center;

        .el-pagination__sizes,
        .el-pagination__jump {
          display: none;
        }
      }
    }
  }

  @media (max-width: 480px) {
    padding: 4px;

    .stats-cards {
      gap: 6px;

      .stat-card {
        padding: 10px;
        min-height: 70px;

        .stat-content {
          gap: 8px;

          .stat-icon {
            width: 36px;
            height: 36px;
            font-size: 16px;
          }

          .stat-info {
            .stat-value {
              font-size: 18px;
            }

            .stat-label {
              font-size: 11px;
            }
          }
        }
      }
    }

    .preorders-tabs {
      :deep(.el-tabs__header) {
        padding: 0 8px;
      }

      :deep(.el-tabs__item) {
        font-size: 12px;
        padding: 0 8px;
        height: 38px;
        line-height: 38px;
      }

      .tab-content {
        padding: 8px;
      }
    }
  }
}
</style>
