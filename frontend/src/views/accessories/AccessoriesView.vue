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
            v-if="canCreate"
            type="success"
            @click="openArchiveModal"
          >
            <i class="fas fa-file-alt" />
            商品模版
          </el-button>
          <el-button
            v-if="canCatalogView"
            @click="router.push('/accessories/catalog')"
          >
            <i class="fas fa-sliders-h" />
            设置
          </el-button>
          <el-button
            type="info"
            :loading="refreshing"
            plain
            :disabled="refreshing"
            @click="handleRefresh"
          >
            <i class="fas fa-sync-alt" />
            {{ refreshing ? '刷新中...' : '刷新' }}
          </el-button>
        </template>
      </PageHeader>

      <div class="accessories-table-container admin-page-content">
        <div
          class="tab-navigation tf-page-tabs"
          role="tablist"
          aria-label="配件管理模式"
        >
          <el-button
            role="tab"
            :aria-selected="activeMode === 'stock'"
            :type="activeMode === 'stock' ? 'primary' : 'default'"
            @click="switchMode('stock')"
          >
            库存查询
          </el-button>
          <el-button
            role="tab"
            :aria-selected="activeMode === 'templates'"
            :type="activeMode === 'templates' ? 'primary' : 'default'"
            @click="switchMode('templates')"
          >
            商品模板
          </el-button>
        </div>
        <div class="tf-tab-content">
          <div
            class="tf-tab-panel"
            role="tabpanel"
            :aria-label="isTemplateMode ? '商品模板' : '库存查询'"
          >
            <UnifiedSearchPanel
              v-model:expanded="searchExpanded"
              :loading="loading"
              @search="handleSearch"
              @reset="handleReset"
            >
              <template #primary>
                <el-input
                  v-model="searchKeyword"
                  placeholder="搜索配件名称、商品类型、品牌或型号..."
                  clearable
                  @keyup.enter="handleSearch"
                  @click.stop
                >
                  <template #prefix>
                    <i class="fas fa-search" />
                  </template>
                </el-input>
                <el-select
                  v-if="isTemplateMode && canViewAccessoryField('status')"
                  v-model="templateStatus"
                  placeholder="模板状态"
                  @change="handleSearch"
                >
                  <el-option
                    label="全部状态"
                    value="all"
                  />
                  <el-option
                    label="启用"
                    :value="1"
                  />
                  <el-option
                    label="停用"
                    :value="0"
                  />
                </el-select>
              </template>
            </UnifiedSearchPanel>

            <div class="table-container table-section admin-panel admin-table-panel">
              <div class="section-header">
                <div class="section-title">
                  <i class="fas fa-list" />
                  {{ isTemplateMode ? '商品模板管理' : '配件库存' }}
                  <span class="record-count">共 {{ total }} 条记录</span>
                </div>
              </div>

              <div class="table-responsive">
                <el-table
                  v-tf-loading="{ active: loading || refreshing, text: '正在刷新配件列表...' }"
                  v-table-double-tap="mobileDetailTapOptions"
                  :data="accessories"
                  border
                  stripe
                  class="data-table devices-table base-data-table accessories-data-table"
                  table-layout="fixed"
                  :fit="true"
                  :row-key="getAccessoryRowKey"
                  @row-dblclick="mobileDetailDoubleClick"
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
                        @click="isTemplateMode ? openArchiveModal() : openStockInModal()"
                      >
                        {{ isTemplateMode ? '商品模版' : '配件入库' }}
                      </el-button>
                    </DataEmptyState>
                  </template>

                  <el-table-column
                    v-if="canViewAccessoryField('sequence')"
                    label="序号"
                    :width="$getNumberColumnWidth(accessories.map((_row, $index) => (currentPage - 1) * itemsPerPage + $index + 1), 64)"
                    align="center"
                  >
                    <template #default="{ $index }">
                      <span class="table-number-badge">{{ (currentPage - 1) * itemsPerPage + $index + 1 }}</span>
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
                    label="商品类型"
                    :min-width="accessoryCategoryColumnWidth"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.category || '-' }}
                    </template>
                  </el-table-column>

                  <el-table-column
                    v-if="!isTemplateMode && canViewAccessoryField('brand_name')"
                    prop="brand_name"
                    label="配件品牌"
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
                    label="适配型号"
                    min-width="116"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.compatible_model_names || [row.model_brand_name, row.model_name].filter(Boolean).join(' ') || '通用' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewAccessoryField('product_model')"
                    prop="product_model"
                    label="配件型号"
                    min-width="116"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.product_model || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="!isTemplateMode && canViewAccessoryField('purchase_cost')"
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
                    label="零售价"
                    min-width="96"
                    align="center"
                  >
                    <template #default="{ row }">
                      <span class="price">¥{{ formatPrice(row.sale_price) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="!isTemplateMode && canViewAccessoryField('profit')"
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
                    v-if="!isTemplateMode && canViewAccessoryField('total_stock')"
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
                    v-if="!isTemplateMode && canViewAccessoryField('total_out')"
                    label="累计出库"
                    min-width="74"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{ row.total_out || 0 }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="!isTemplateMode && canViewAccessoryField('remaining_stock')"
                    label="剩余"
                    :min-width="isMobile ? 72 : 78"
                    align="center"
                  >
                    <template #default="{ row }">
                      <el-button
                        v-if="!isMobile && canView && (Number(row.serial_tracking) !== 1 || canViewAccessoryField('serial_number'))"
                        text
                        class="btn btn-text"
                        :aria-label="`查看${row.name || '商品'}的剩余库存明细与店铺`"
                        @click.stop="viewAccessoryDetails(row)"
                      >
                        {{ row.remaining_stock ?? '-' }}
                      </el-button>
                      <span v-else>{{ row.remaining_stock ?? '-' }}</span>
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
                        {{ isAccessoryEnabled(row) ? '启用' : '停用' }}
                      </span>
                    </template>
                  </el-table-column>

                  <el-table-column
                    v-if="!isMobile && showActionColumn"
                    label="操作"
                    :width="$getActionColumnWidth(1 + Number(canCreate) + Number(canEdit) + Number(canDelete) + Number(canTransfer && !isTemplateMode))"
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
                          v-if="canCreate && isAccessoryEnabled(row)"
                          type="primary"
                          size="small"
                          @click.stop="stockInAccessory(row)"
                        >
                          <i class="fas fa-box" /><span>入库</span>
                        </el-button>
                        <el-button
                          v-if="!isTemplateMode && canTransfer"
                          v-permission="'accessories:transfer'"
                          type="warning"
                          size="small"
                          @click.stop="transferAccessory(row)"
                        >
                          <i class="fas fa-exchange-alt" /><span>划拨</span>
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
                          v-if="canDelete && isAccessoryEnabled(row)"
                          type="danger"
                          size="small"
                          title="删除（停用），保留历史记录"
                          @click.stop="deleteAccessory(row)"
                        >
                          <i class="fas fa-trash" />
                          <span>删除</span>
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>

              <Pagination
                v-if="total > 0"
                v-model:current="currentPage"
                v-model:page-size="itemsPerPage"
                :total="total"
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
        </div>
      </div>

      <AccessoryDetailsModal
        v-if="showDetailsModal && selectedAccessory"
        :accessory="selectedAccessory"
        :has-actions="canEdit || (canCreate && isAccessoryEnabled(selectedAccessory)) || (!isTemplateMode && canTransfer) || (canDelete && isAccessoryEnabled(selectedAccessory))"
        @close="closeDetailsModal"
      >
        <template #actions>
          <el-button
            v-if="canCreate && isAccessoryEnabled(selectedAccessory)"
            type="primary"
            @click.stop="runAccessoryDetailAction(stockInAccessory)"
          >
            <i class="fas fa-box" /><span>入库</span>
          </el-button>
          <el-button
            v-if="!isTemplateMode && canTransfer"
            v-permission="'accessories:transfer'"
            type="warning"
            @click.stop="runAccessoryDetailAction(transferAccessory)"
          >
            <i class="fas fa-exchange-alt" /><span>划拨</span>
          </el-button>
          <el-button
            v-if="canEdit"
            type="success"
            @click.stop="runAccessoryDetailAction(editAccessory)"
          >
            <i class="fas fa-edit" /><span>编辑</span>
          </el-button>
          <el-button
            v-if="canDelete && isAccessoryEnabled(selectedAccessory)"
            type="danger"
            @click.stop="runAccessoryDetailAction(deleteAccessory)"
          >
            <i class="fas fa-trash" /><span>删除</span>
          </el-button>
        </template>
      </AccessoryDetailsModal>

      <AccessoryTransferModal
        v-if="showTransferModal && selectedAccessory"
        v-model="showTransferModal"
        :accessory="selectedAccessory"
        @success="handleSaved"
      />

      <AccessoryStockInModal
        v-if="showStockInModal"
        v-model="showStockInModal"
        :accessory="selectedAccessory || undefined"
        :archive-only="archiveOnlyModal"
        :stock-in-only="stockInOnlyModal"
        @success="handleSaved"
      />
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { formatAmount } from '@/utils/format'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useLoadingState } from '@/composables'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { useNotification } from '@/composables/useNotification'
import { PageHeader, PermissionGate } from '@/components/base'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { getRequestErrorMessage } from '@/utils/api-response'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { logger } from '@/utils/logger'
import { getTextColumnMinWidth } from '@/utils/table-layout'
import { unifiedApi as api } from '@/utils/unified-api'
import { canViewAccessoryField } from '@/components/accessory-field-permissions'
const globalNotifications = useNotification()
const router = useRouter()


import type { AccessoryRecord } from '@/types/accessory'
import type { PaginatedResponse } from '@/types'

const AccessoryTransferModal = defineAsyncComponent(() => import('@/components/AccessoryTransferModal.vue'))
const showTransferModal = ref(false)
const transferAccessory = (row: AccessoryRecord) => {
  if (!requirePermission('transfer')) return
  selectedAccessory.value = row
  showTransferModal.value = true
}

const AccessoryDetailsModal = defineAsyncComponent(() => import('@/components/AccessoryDetailsModal.vue'))
const AccessoryStockInModal = defineAsyncComponent(() => import('@/components/AccessoryStockInModal.vue'))

const { canView, canCreate, canEdit, canDelete, handleNoPermission, hasPermission, requirePermission } = usePagePermissions('accessories')
const canTransfer = computed(() => hasPermission('transfer'))
const { canView: canCatalogView } = usePagePermissions('accessories-catalog')
const showActionColumn = computed(() => shouldShowActionColumn(
  canViewAccessoryField('operations'),
  [canCreate.value, canEdit.value, canDelete.value, canTransfer.value]
))
const { refreshing, refresh } = useRefreshData()
const { isMobile } = useMobile()
const { loading } = useLoadingState()
const { confirm } = useNotification()

loading.value = true
const error = ref('')
const accessories = ref<AccessoryRecord[]>([])
const total = ref(0)
const activeMode = ref<'stock' | 'templates'>('stock')
const isTemplateMode = computed(() => activeMode.value === 'templates')
const templateStatus = ref<'all' | 0 | 1>('all')
const { nextRequest, isCanceledError } = useLatestRequest()
const templateEditRequest = useLatestRequest()
const showDetailsModal = ref(false)
const showStockInModal = ref(false)
const archiveOnlyModal = ref(false)
const stockInOnlyModal = ref(false)
const selectedAccessory = ref<AccessoryRecord | null>(null)
const searchExpanded = ref(false)
const searchKeyword = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(16)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

const accessoryNameColumnWidth = computed(() => getTextColumnMinWidth(
  ['配件名称', ...(canViewAccessoryField('name') ? accessories.value.map(accessory => accessory.name) : [])],
  { minWidth: isMobile.value ? 104 : 140, horizontalPadding: 28 }
))

const accessoryCategoryColumnWidth = computed(() => getTextColumnMinWidth(
  ['商品类型', ...(canViewAccessoryField('category') ? accessories.value.map(accessory => accessory.category) : [])],
  { minWidth: isMobile.value ? 84 : 100, horizontalPadding: 28 }
))

const getAccessoryRowKey = (accessory: AccessoryRecord) => String(accessory.id)

const getTotalStock = (accessory: AccessoryRecord) => Number(accessory.total_stock ?? 0)

const getStockStatusBadgeClass = (accessory: AccessoryRecord) => {
  if (!canViewAccessoryField('stock_status')) return ''
  const stock = getTotalStock(accessory)
  if (stock === 0) return 'status-out-of-stock'
  if (canViewAccessoryField('min_stock') && stock <= Number(accessory.min_stock ?? 5)) return 'status-low-stock'
  return 'status-in-stock'
}

const handleSearch = async () => {
  currentPage.value = 1
  await loadAccessories()
}

const handleReset = async () => {
  searchKeyword.value = ''
  templateStatus.value = 'all'
  await handleSearch()
}

const switchMode = async (mode: 'stock' | 'templates') => {
  if (activeMode.value === mode) return
  activeMode.value = mode
  await handleReset()
}

const isAccessoryEnabled = (accessory: AccessoryRecord) => (
  accessory.status === 1 || accessory.status === '1' || accessory.status === true
)

const formatPrice = (price?: number | string) => {
  return formatAmount(price)
}

const loadAccessories = async (showLoadingState = true) => {
  if (!canView.value) return
  const request = nextRequest()
  try {
    if (showLoadingState) loading.value = true
    error.value = ''
    const response = await api.get<Pick<PaginatedResponse<AccessoryRecord>, 'data' | 'pagination'>>('/accessories', {
      params: {
        mode: isTemplateMode.value ? 'templates' : 'inventory',
        page: currentPage.value,
        page_size: itemsPerPage.value,
        search: searchKeyword.value.trim() || undefined,
        status: canViewAccessoryField('status') ? (isTemplateMode.value ? templateStatus.value : 1) : undefined
      },
      signal: request.signal,
      useCache: false
    })
    if (!request.isLatest()) return
    accessories.value = response.data?.data || []
    total.value = Number(response.data?.pagination.total || 0)
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value
      await loadAccessories(showLoadingState)
    }
  } catch (err) {
    if (!request.isLatest() || isCanceledError(err)) return
    logger.error('加载配件数据失败', err)
    accessories.value = []
    total.value = 0
    error.value = '加载配件数据失败，请稍后重试'
  } finally {
    if (request.isLatest()) loading.value = false
  }
}

const handleSaved = async () => {
  selectedAccessory.value = null
  await loadAccessories()
}

const handleRefresh = async () => {
  await refresh(() => loadAccessories(false))
  if (!error.value) globalNotifications.success('数据刷新成功')
}

const openStockInModal = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }
  selectedAccessory.value = null
  stockInOnlyModal.value = false
  archiveOnlyModal.value = false
  showStockInModal.value = true
}

const stockInAccessory = (accessory: AccessoryRecord) => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }
  selectedAccessory.value = accessory
  archiveOnlyModal.value = false
  stockInOnlyModal.value = true
  showStockInModal.value = true
}

const openArchiveModal = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }
  selectedAccessory.value = null
  stockInOnlyModal.value = false
  archiveOnlyModal.value = true
  showStockInModal.value = true
}

const viewAccessoryDetails = (accessory: AccessoryRecord) => {
  selectedAccessory.value = accessory
  showDetailsModal.value = true
}

const editAccessory = async (accessory: AccessoryRecord) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
  const request = templateEditRequest.nextRequest()
  try {
    const template = accessory.template_id
      ? (await api.get<AccessoryRecord>(`/accessories/${accessory.template_id}`, {
        signal: request.signal, useCache: false
      })).data
      : accessory
    if (!request.isLatest()) return
    if (!template?.id) {
      globalNotifications.error('未找到对应商品模板，请刷新后重试')
      return
    }
    stockInOnlyModal.value = false
    archiveOnlyModal.value = false
    selectedAccessory.value = template
    showStockInModal.value = true
  } catch (err) {
    if (!request.isLatest() || templateEditRequest.isCanceledError(err)) return
    logger.error('加载商品模板失败', err)
    globalNotifications.error(getRequestErrorMessage(err, '加载商品模板失败，请重试'))
  }
}

const deleteAccessory = async (accessory: AccessoryRecord) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    const targetName = canViewAccessoryField('name') ? accessory.name || '该配件' : '该配件'
    if (!await confirm(`确定删除 ${targetName} 吗？删除将停用此模板，保留库存和历史单据；可在商品模板中编辑恢复启用。`, '删除商品模板', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })) return
  } catch {
    return
  }

  try {
    await api.delete(`/accessories/${accessory.template_id || accessory.id}`)
    await loadAccessories()
    globalNotifications.success('商品模板已删除（停用），历史记录已保留')
  } catch (err) {
    logger.error('删除配件失败', err)
    globalNotifications.error(getRequestErrorMessage(err, '删除失败，请重试'))
  }
}

const closeDetailsModal = () => {
  showDetailsModal.value = false
  selectedAccessory.value = null
}



const handlePaginationChange = async (page: number, pageSize: number) => {
  currentPage.value = page
  itemsPerPage.value = pageSize
  await loadAccessories()
}

onMounted(async () => {
  await fieldPermissions.init()
  if (!canView.value) {
    loading.value = false
    return
  }
  await loadAccessories()
})

const { doubleTapOptions: mobileDetailTapOptions, handleRowDoubleClick: mobileDetailDoubleClick } = useMobileTableDetail<AccessoryRecord>({
  enabled: () => isMobile.value && canView.value, rows: accessories, getKey: getAccessoryRowKey, onOpen: viewAccessoryDetails
})
const runAccessoryDetailAction = (action: (row: AccessoryRecord) => unknown) => {
  const row = selectedAccessory.value
  if (!row) return
  closeDetailsModal()
  return action(row)
}
</script>

<style scoped>
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
