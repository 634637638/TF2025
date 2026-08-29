<template>
  <div class="accessories-view admin-page admin-unified-base-data-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="accessories"
      module-name="配件管理"
      permission-code="accessories:view"
    >
      <PageHeader
        icon="fas fa-box"
        title="配件管理"
      >
        <template #actions>
          <el-button
            v-if="canCreate"
            type="primary"
            @click="openStockInModal"
          >
            <i class="fas fa-box" />
            配件入库
          </el-button>
          <el-button
            type="info"
            plain
            :disabled="refreshing"
            @click="handleRefresh"
          >
            <InlineLoading
              v-if="refreshing"
              size="small"
            />
            <i
              v-else
              class="fas fa-sync-alt"
            />
            刷新
          </el-button>
        </template>
      </PageHeader>

      <div class="accessories-table-container admin-page-content">
        <div class="table-container table-section admin-panel admin-table-panel">
          <div class="section-header">
            <div class="section-title">
              <i class="fas fa-list" />
              配件列表
              <span class="record-count">共 {{ accessories.length }} 条记录</span>
            </div>
          </div>

          <div class="table-responsive">
            <el-table
              :data="loading ? [] : paginatedAccessories"
              border
              stripe
              class="data-table devices-table base-data-table accessories-data-table"
              table-layout="fixed"
              :fit="true"
              :row-key="getAccessoryRowKey"
              :expand-row-keys="isMobile && mobileActionRowId ? [mobileActionRowId] : []"
              @row-click="handleAccessoryRowClick"
            >
              <template #empty>
                <TableLoadingRow
                  v-if="loading"
                  mode="block"
                  text="加载配件数据中..."
                />
                <DataEmptyState
                  v-else-if="error"
                  state="error"
                  title="配件数据加载失败"
                  :description="error"
                  action-text="重试"
                  @action="loadAccessories()"
                />
                <DataEmptyState
                  v-else
                  description="暂无配件数据"
                >
                  <el-button
                    v-if="canCreate"
                    type="primary"
                    size="small"
                    @click="openStockInModal"
                  >
                    配件入库
                  </el-button>
                </DataEmptyState>
              </template>

              <el-table-column
                v-if="canViewAccessoryField('sequence')"
                label="序号"
                width="64"
                align="center"
              >
                <template #default="{ $index }">
                  <span class="id-badge">{{ (currentPage - 1) * itemsPerPage + $index + 1 }}</span>
                </template>
              </el-table-column>

              <el-table-column
                v-if="canViewAccessoryField('name')"
                prop="name"
                label="配件名称"
                :min-width="accessoryNameColumnWidth"
                align="center"
              >
                <template #default="{ row }">
                  <strong>{{ row.name || '-' }}</strong>
                </template>
              </el-table-column>

              <el-table-column
                v-if="canViewAccessoryField('category')"
                prop="category"
                label="分类"
                :min-width="accessoryCategoryColumnWidth"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.category || '-' }}
                </template>
              </el-table-column>

              <el-table-column
                v-if="canViewAccessoryField('brand_name')"
                prop="brand_name"
                label="品牌"
                min-width="104"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.brand_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewAccessoryField('model_name')"
                prop="model_name"
                label="型号"
                min-width="116"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.model_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewAccessoryField('purchase_cost')"
                label="进价"
                min-width="96"
                align="center"
              >
                <template #default="{ row }">
                  <span class="price">¥{{ formatPrice(row.purchase_cost) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewAccessoryField('sale_price')"
                label="售价"
                min-width="96"
                align="center"
              >
                <template #default="{ row }">
                  <span class="price">¥{{ formatPrice(row.sale_price) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewAccessoryField('profit')"
                label="毛利"
                min-width="96"
                align="center"
              >
                <template #default="{ row }">
                  <span :class="['profit-value', Number(row.profit || 0) >= 0 ? 'profit-positive' : 'profit-negative']">
                    ¥{{ formatPrice(row.profit) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewAccessoryField('total_stock')"
                label="总库存"
                min-width="102"
                align="center"
              >
                <template #default="{ row }">
                  <span :class="['status-badge', getStockStatusBadgeClass(row)]">
                    {{ getTotalStock(row) }}<template v-if="canViewAccessoryField('unit')"> {{ row.unit || '件' }}</template>
                  </span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewAccessoryField('total_out')"
                label="已售"
                min-width="74"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.total_out || 0 }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewAccessoryField('remaining_stock')"
                label="剩余"
                :min-width="isMobile ? 72 : 78"
                align="center"
              >
                <template #default="{ row }">
                  <span :class="Number(row.remaining_stock || 0) < 10 ? 'stock-low' : 'stock-normal'">
                    {{ row.remaining_stock ?? '-' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewAccessoryField('unit')"
                prop="unit"
                label="单位"
                min-width="70"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.unit || '件' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewAccessoryField('status')"
                label="状态"
                :min-width="isMobile ? 72 : 80"
                align="center"
              >
                <template #default="{ row }">
                  <span :class="['status-badge', isAccessoryEnabled(row) ? 'status-enabled' : 'status-disabled']">
                    {{ isAccessoryEnabled(row) ? '启用' : '禁用' }}
                  </span>
                </template>
              </el-table-column>

              <el-table-column
                v-if="!isMobile && showActionColumn"
                label="操作"
                :width="$getActionColumnWidth(1 + Number(canEdit) + Number(canDelete))"
                align="center"
                class-name="actions-column"
              >
                <template #default="{ row }">
                  <div class="action-buttons">
                    <el-button
                      type="primary"
                      size="small"
                      title="详情"
                      @click.stop="viewAccessoryDetails(row)"
                    >
                      <i class="fas fa-eye" />
                      <span>详情</span>
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="success"
                      size="small"
                      title="编辑"
                      @click.stop="editAccessory(row)"
                    >
                      <i class="fas fa-edit" />
                      <span>编辑</span>
                    </el-button>
                    <el-button
                      v-if="canDelete"
                      type="danger"
                      size="small"
                      title="删除"
                      @click.stop="deleteAccessory(row)"
                    >
                      <i class="fas fa-trash" />
                      <span>删除</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>

              <el-table-column
                v-if="isMobile && showActionColumn"
                type="expand"
                width="1"
                class-name="mobile-expand-column"
                label-class-name="mobile-expand-header"
              >
                <template #default="{ row }">
                  <div class="mobile-row-actions">
                    <el-button
                      type="primary"
                      size="small"
                      @click.stop="viewAccessoryDetails(row)"
                    >
                      <i class="fas fa-eye" /><span>详情</span>
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="success"
                      size="small"
                      @click.stop="editAccessory(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button>
                    <el-button
                      v-if="canDelete"
                      type="danger"
                      size="small"
                      @click.stop="deleteAccessory(row)"
                    >
                      <i class="fas fa-trash" /><span>删除</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <Pagination
            v-if="accessories.length > 0"
            v-model:current="currentPage"
            v-model:page-size="itemsPerPage"
            :total="accessories.length"
            :page-sizes="[16, 32, 64, 100]"
            :show-total="true"
            :show-range="true"
            :show-page-sizes="true"
            :show-quick-jumper="true"
            :disabled="loading"
            @change="handlePaginationChange"
          />
        </div>
      </div>

      <AccessoryDetailsModal
        v-if="showDetailsModal && selectedAccessory"
        :accessory="selectedAccessory"
        @close="closeDetailsModal"
      />

      <AccessoryStockInModal
        v-if="showStockInModal"
        v-model="showStockInModal"
        :accessory="selectedAccessory"
        @success="loadAccessories"
      />
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useLoadingState } from '@/composables'
import { useMobile } from '@/composables/mobile'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { PageHeader, PermissionGate } from '@/components/base'
import InlineLoading from '@/components/InlineLoading.vue'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { extractResponseData } from '@/utils/api-response'
import { logger } from '@/utils/logger'
import { getTextColumnMinWidth } from '@/utils/table-layout'
import { unifiedApi as api } from '@/utils/unified-api'
import { canViewAccessoryField } from '@/components/accessory-field-permissions'

interface AccessoryItem {
  id: number
  name?: string
  category?: string
  brand_name?: string
  model_name?: string
  purchase_cost?: number | string
  sale_price?: number | string
  total_stock?: number | string
  total_in?: number | string
  total_out?: number | string
  profit?: number | string
  remaining_stock?: number | string
  unit?: string
  status?: number | string | boolean
}

const AccessoryDetailsModal = defineAsyncComponent(() => import('@/components/AccessoryDetailsModal.vue'))
const AccessoryStockInModal = defineAsyncComponent(() => import('@/components/AccessoryStockInModal.vue'))

const { canView, canCreate, canEdit, canDelete, handleNoPermission } = usePagePermissions('accessories')
const showActionColumn = computed(() => shouldShowActionColumn(
  canViewAccessoryField('operations'),
  [canEdit.value, canDelete.value]
))
const { refreshing, refresh } = useRefreshData()
const { isMobile } = useMobile()
const { loading } = useLoadingState()

loading.value = true
const error = ref('')
const accessories = ref<AccessoryItem[]>([])
const showDetailsModal = ref(false)
const showStockInModal = ref(false)
const selectedAccessory = ref<AccessoryItem | null>(null)
const currentPage = ref(1)
const itemsPerPage = ref(16)
const mobileActionRowId = ref<string | null>(null)
const lastTappedRowId = ref<string | null>(null)
const lastTapTimestamp = ref(0)

const paginatedAccessories = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return accessories.value.slice(start, start + itemsPerPage.value)
})

const totalPages = computed(() => Math.max(1, Math.ceil(accessories.value.length / itemsPerPage.value)))

const accessoryNameColumnWidth = computed(() => getTextColumnMinWidth(
  ['配件名称', ...(canViewAccessoryField('name') ? paginatedAccessories.value.map(accessory => accessory.name) : [])],
  { minWidth: isMobile.value ? 104 : 140, horizontalPadding: 28 }
))

const accessoryCategoryColumnWidth = computed(() => getTextColumnMinWidth(
  ['分类', ...(canViewAccessoryField('category') ? paginatedAccessories.value.map(accessory => accessory.category) : [])],
  { minWidth: isMobile.value ? 84 : 100, horizontalPadding: 28 }
))

const getAccessoryRowKey = (accessory: AccessoryItem) => String(accessory.id)

const getTotalStock = (accessory: AccessoryItem) => Number(accessory.total_stock ?? 0)

const getStockStatusBadgeClass = (accessory: AccessoryItem) => {
  const stock = getTotalStock(accessory)
  if (stock === 0) return 'status-out-of-stock'
  if (stock <= 20) return 'status-low-stock'
  return 'status-in-stock'
}

const isAccessoryEnabled = (accessory: AccessoryItem) => (
  accessory.status === 1 || accessory.status === '1' || accessory.status === true
)

const formatPrice = (price?: number | string) => {
  const value = Number.parseFloat(String(price ?? 0)) || 0
  return Number.isInteger(value)
    ? value.toLocaleString('zh-CN')
    : Number.parseFloat(value.toFixed(2)).toLocaleString('zh-CN')
}

const loadAccessories = async (showLoadingState = true) => {
  try {
    if (showLoadingState) loading.value = true
    error.value = ''
    const response = await api.get('/accessories')
    accessories.value = extractResponseData<AccessoryItem[]>(response)
    if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
    logger.info(`配件数据加载成功，共 ${accessories.value.length} 条`)
  } catch (err) {
    logger.error('加载配件数据失败', err)
    accessories.value = []
    error.value = '加载配件数据失败，请稍后重试'
  } finally {
    if (showLoadingState) loading.value = false
  }
}

const handleRefresh = async () => {
  await refresh(() => loadAccessories(false))
  if (!error.value) ElMessage.success('数据刷新成功')
}

const openStockInModal = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }
  selectedAccessory.value = null
  showStockInModal.value = true
}

const viewAccessoryDetails = (accessory: AccessoryItem) => {
  selectedAccessory.value = accessory
  showDetailsModal.value = true
}

const editAccessory = (accessory: AccessoryItem) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
  selectedAccessory.value = accessory
  showStockInModal.value = true
}

const deleteAccessory = async (accessory: AccessoryItem) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    const targetName = canViewAccessoryField('name') ? accessory.name || '该配件' : '该配件'
    await ElMessageBox.confirm(`确定要删除 ${targetName} 吗？此操作不可撤销。`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'message-box-unified'
    })
  } catch {
    return
  }

  try {
    await api.delete(`/accessories/${accessory.id}`)
    accessories.value = accessories.value.filter(item => item.id !== accessory.id)
    if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
    ElMessage.success('删除成功')
  } catch (err) {
    logger.error('删除配件失败', err)
    ElMessage.error('删除失败，请重试')
  }
}

const closeDetailsModal = () => {
  showDetailsModal.value = false
  selectedAccessory.value = null
}

const toggleMobileActions = (rowId: string) => {
  if (!isMobile.value) return
  mobileActionRowId.value = mobileActionRowId.value === rowId ? null : rowId
}

const handleAccessoryRowClick = (row: AccessoryItem, _column: unknown, event: Event) => {
  if (!isMobile.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, textarea, select, .el-button, .el-input, .el-select')) return

  const rowId = getAccessoryRowKey(row)
  const now = Date.now()
  if (lastTappedRowId.value === rowId && now - lastTapTimestamp.value <= 320) {
    toggleMobileActions(rowId)
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRowId.value = rowId
  lastTapTimestamp.value = now
}

const handlePaginationChange = (page: number, pageSize: number) => {
  currentPage.value = page
  itemsPerPage.value = pageSize
  mobileActionRowId.value = null
}

watch(itemsPerPage, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
})

onMounted(async () => {
  await fieldPermissions.init()
  if (!canView.value) {
    loading.value = false
    return
  }
  await loadAccessories()
})
</script>

<style scoped>
.table-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 180px;
  color: var(--el-text-color-secondary);
}

.table-state p {
  margin: 0;
}

.table-error-state i {
  color: var(--el-color-warning);
}

.price,
.profit-value {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.profit-positive,
.stock-normal {
  color: var(--el-color-success);
}

.profit-negative,
.stock-low {
  color: var(--el-color-danger);
}

.status-enabled,
.status-in-stock {
  background: var(--tf-status-success-bg);
  color: var(--tf-status-success-color);
  border: 1px solid var(--tf-status-success-border);
}

.status-disabled {
  background: var(--tf-status-neutral-bg);
  color: var(--tf-status-neutral-color);
  border: 1px solid var(--tf-status-neutral-border);
}

.status-low-stock {
  background: var(--tf-status-warning-bg);
  color: var(--tf-status-warning-color);
  border: 1px solid var(--tf-status-warning-border);
}

.status-out-of-stock {
  background: var(--tf-status-danger-bg);
  color: var(--tf-status-danger-color);
  border: 1px solid var(--tf-status-danger-border);
}
</style>
