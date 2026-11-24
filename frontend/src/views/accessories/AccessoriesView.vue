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
            v-if="canStockIn"
            class="tf-button--transfer"
            @click="openStockInModal"
          >
            <i class="fas fa-box" />
            商品入库
          </el-button>
          <el-button
            v-if="canCreate"
            type="primary"
            @click="openArchiveModal"
          >
            <i class="fas fa-file-alt" />
            商品模版
          </el-button>
          <el-button
            v-if="canCatalogView"
            class="tf-button--manage"
            @click="router.push('/accessories/catalog')"
          >
            <i class="fas fa-sliders-h" />
            设置
          </el-button>
          <el-button
            class="tf-button--refresh"
            :loading="refreshing"
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
            商品库存
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
            :aria-label="isTemplateMode ? '商品模板' : '商品库存'"
          >
            <el-alert
              v-if="filterOptionsError"
              :title="filterOptionsError"
              type="error"
              :closable="false"
            >
              <el-button
                link
                type="primary"
                :loading="filterOptionsLoading"
                @click="loadFilterOptions"
              >
                重新加载筛选项
              </el-button>
            </el-alert>
            <UnifiedSearchPanel
              v-model:expanded="searchExpanded"
              :loading="loading"
              @search="handleSearch"
              @reset="handleReset"
            >
              <template #primary>
                <el-input
                  v-if="canViewAccessoryField('name')"
                  v-model="searchKeyword"
                  placeholder="搜索商品名称、型号或条形码"
                  aria-label="商品名称"
                  clearable
                  :maxlength="200"
                  @keyup.enter="handleSearch"
                  @clear="handleSearch"
                  @click.stop
                >
                  <template #prefix>
                    <i class="fas fa-search" />
                  </template>
                </el-input>
              </template>
              <div
                v-if="canViewAccessoryField('category')"
                class="form-group filter-item"
                data-field="category"
              >
                <el-select
                  v-model="filters.category"
                  placeholder="商品类型"
                  aria-label="商品类型"
                  clearable
                  filterable
                  :loading="filterOptionsLoading"
                  @change="handleSearch"
                >
                  <el-option
                    v-for="item in filterOptions.categories"
                    :key="String(item.id)"
                    :label="item.name"
                    :value="item.name || ''"
                  />
                </el-select>
              </div>
              <div
                v-if="canViewAccessoryField('brand_name')"
                class="form-group filter-item"
                data-field="brand_id"
              >
                <el-select
                  v-model="filters.brand_id"
                  placeholder="品牌"
                  aria-label="品牌"
                  clearable
                  filterable
                  :loading="filterOptionsLoading"
                  @change="handleSearch"
                >
                  <el-option
                    v-for="item in filterOptions.brands"
                    :key="String(item.id)"
                    :label="item.name"
                    :value="Number(item.id)"
                  />
                </el-select>
              </div>
              <div
                v-if="canViewAccessoryField('model_name')"
                class="form-group filter-item"
                data-field="model_name"
              >
                <el-input
                  v-model="filters.model_name"
                  placeholder="适配型号（支持模糊检索）"
                  aria-label="适配型号"
                  clearable
                  :maxlength="200"
                  @keyup.enter="handleSearch"
                  @clear="handleSearch"
                />
              </div>
              <div
                v-if="canViewAccessoryField('color_name')"
                class="form-group filter-item"
                data-field="color_id"
              >
                <el-select
                  v-model="filters.color_id"
                  placeholder="颜色"
                  aria-label="颜色"
                  clearable
                  filterable
                  :loading="filterOptionsLoading"
                  @change="handleSearch"
                >
                  <el-option
                    v-for="item in filterOptions.colors"
                    :key="String(item.id)"
                    :label="item.name"
                    :value="Number(item.id)"
                  />
                </el-select>
              </div>
              <div
                v-if="canViewAccessoryField('status')"
                class="form-group filter-item"
                data-field="status"
              >
                <el-select
                  v-model="listStatus"
                  placeholder="状态"
                  aria-label="状态"
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
              </div>
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
                        v-if="isTemplateMode ? canCreate : canStockIn"
                        :class="isTemplateMode ? 'tf-button--save' : 'tf-button--transfer'"
                        @click="isTemplateMode ? openArchiveModal() : openStockInModal()"
                      >
                        {{ isTemplateMode ? '商品模版' : '商品入库' }}
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
                    label="商品名称"
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
                    label="适配型号"
                    min-width="116"
                    align="center"
                  >
                    <template #default="{ row }">
                      <el-tooltip
                        v-if="getAccessoryModelDetails(row) !== '通用'"
                        :content="getAccessoryModelDetails(row)"
                        placement="top"
                        :trigger="isTouchDevice ? 'click' : ['hover', 'focus']"
                        :popper-style="{ maxWidth: 'calc(100vw - var(--spacing-lg) * 2)', maxHeight: '50dvh', overflowY: 'auto' }"
                        :popper-options="{ modifiers: [{ name: 'preventOverflow', options: { altAxis: true } }] }"
                      >
                        <span
                          tabindex="0"
                          class="accessory-model-summary"
                        >{{ getAccessoryModelSummary(row) }}</span>
                      </el-tooltip>
                      <span
                        v-else
                        class="accessory-model-summary"
                      >通用</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewAccessoryField('color_name')"
                    label="颜色"
                    min-width="108"
                    align="center"
                    class-name="wrapped-text-column"
                  >
                    <template #default="{ row }">
                      {{ getAccessoryColors(row) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="isTemplateMode && canViewAccessoryField('barcode')"
                    label="条形码"
                    min-width="156"
                    align="center"
                    class-name="wrapped-text-column"
                  >
                    <template #default="{ row }">
                      {{ getAccessoryBarcodes(row) }}
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
                        class="table-inline-action table-action--view"
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
                    :width="$getActionColumnWidth(['详情', ...(canStockIn ? ['入库'] : []), ...(!isTemplateMode && canTransfer ? ['划拨'] : []), ...(canEdit ? ['编辑'] : []), ...(canEdit && !isTemplateMode ? ['编辑档案'] : []), ...(canDelete ? ['删除'] : [])])"
                    align="center"
                    class-name="actions-column"
                  >
                    <template #default="{ row }">
                      <div class="action-buttons">
                        <el-button
                          class="table-action table-action--view"
                          title="详情"
                          @click.stop="viewAccessoryDetails(row)"
                        >
                          <i class="fas fa-eye" />
                          <span>详情</span>
                        </el-button>
                        <el-button
                          v-if="canStockIn && isAccessoryEnabled(row)"
                          class="table-action table-action--transfer"
                          @click.stop="stockInAccessory(row)"
                        >
                          <i class="fas fa-box" /><span>入库</span>
                        </el-button>
                        <el-button
                          v-if="!isTemplateMode && canTransfer"
                          v-permission="'accessories:transfer'"
                          class="table-action table-action--transfer"
                          @click.stop="transferAccessory(row)"
                        >
                          <i class="fas fa-exchange-alt" /><span>划拨</span>
                        </el-button>
                        <el-button
                          v-if="canEdit"
                          class="table-action table-action--edit"
                          :title="isTemplateMode ? '编辑商品模板' : '更正原入库'"
                          @click.stop="editAccessory(row)"
                        >
                          <i class="fas fa-edit" />
                          <span>编辑</span>
                        </el-button>
                        <el-button
                          v-if="canEdit && !isTemplateMode"
                          class="table-action table-action--edit"
                          title="更正商品档案并同步历史商品资料"
                          @click.stop="editProductProfile(row)"
                        >
                          <i class="fas fa-pen-to-square" />
                          <span>编辑档案</span>
                        </el-button>
                        <el-button
                          v-if="canDelete && (isTemplateMode ? isAccessoryEnabled(row) : canDeleteUnusedBrandVariant(row))"
                          class="table-action table-action--delete"
                          :title="isTemplateMode ? '删除商品模板（停用），保留历史记录' : (canDeleteUnusedBrandVariant(row) ? '删除无库存、无销售、无划拨且无历史关联的品牌商品' : '删除（停用），保留历史记录')"
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
        :has-actions="canEdit || (canStockIn && isAccessoryEnabled(selectedAccessory)) || (!isTemplateMode && canTransfer) || (canDelete && (isTemplateMode ? isAccessoryEnabled(selectedAccessory) : canDeleteUnusedBrandVariant(selectedAccessory)))"
        @close="closeDetailsModal"
        @success="handleInventoryAdjusted"
      >
        <template #actions>
          <el-button
            v-if="canStockIn && isAccessoryEnabled(selectedAccessory)"
            class="tf-button--transfer"
            @click.stop="runAccessoryDetailAction(stockInAccessory)"
          >
            <i class="fas fa-box" /><span>入库</span>
          </el-button>
          <el-button
            v-if="!isTemplateMode && canTransfer"
            v-permission="'accessories:transfer'"
            class="tf-button--transfer"
            @click.stop="runAccessoryDetailAction(transferAccessory)"
          >
            <i class="fas fa-exchange-alt" /><span>划拨</span>
          </el-button>
          <el-button
            v-if="canEdit"
            type="primary"
            @click.stop="runAccessoryDetailAction(editAccessory)"
          >
            <i class="fas fa-edit" /><span>编辑</span>
          </el-button>
          <el-button
            v-if="canEdit && !isTemplateMode"
            type="primary"
            @click.stop="runAccessoryDetailAction(editProductProfile)"
          >
            <i class="fas fa-pen-to-square" /><span>编辑档案</span>
          </el-button>
          <el-button
            v-if="canDelete && (isTemplateMode ? isAccessoryEnabled(selectedAccessory) : canDeleteUnusedBrandVariant(selectedAccessory))"
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
        :stock-edit-only="stockEditOnlyModal"
        :profile-edit-only="profileEditOnlyModal"
        @success="handleSaved"
      />
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { formatAmount } from '@/utils/format'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePageShortcuts, useRouteDialog } from '@/composables/useRouteDialog'

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
import { getRequestErrorCode, getRequestErrorMessage, getRequestErrorStatus } from '@/utils/api-response'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { logger } from '@/utils/logger'
import { getTextColumnMinWidth } from '@/utils/table-layout'
import { unifiedApi as api } from '@/utils/unified-api'
import { canViewAccessoryField } from '@/components/accessory-field-permissions'
import { getAccessoryEntryOptions, type AccessoryEntryOptions } from '@/services/reference-options'
import { sortOptionsByOrder } from '@/utils/option-sort'
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
const canStockIn = computed(() => hasPermission('stock-in'))
const canTransfer = computed(() => hasPermission('transfer'))
const { canView: canCatalogView } = usePagePermissions('accessories-catalog')
const showActionColumn = computed(() => shouldShowActionColumn(
  canViewAccessoryField('operations'),
  [canCreate.value, canStockIn.value, canEdit.value, canDelete.value, canTransfer.value]
))
const { refreshing, refreshData: refresh } = useRefreshData()
const { isMobile, isTouchDevice } = useMobile()
const { loading } = useLoadingState()
const { confirm } = useNotification()

loading.value = true
const error = ref('')
const accessories = ref<AccessoryRecord[]>([])
const total = ref(0)
const activeMode = ref<'stock' | 'templates'>('stock')
const isTemplateMode = computed(() => activeMode.value === 'templates')
const listStatus = ref<'all' | 0 | 1>(1)
const { nextRequest, isCanceledError } = useLatestRequest()
const templateEditRequest = useLatestRequest()
const profileEditOnlyModal = ref(false)
const detailRefreshRequest = useLatestRequest()
const showDetailsModal = ref(false)
const showStockInModal = ref(false)
const archiveOnlyModal = ref(false)
const stockInOnlyModal = ref(false)
const stockEditOnlyModal = ref(false)
const selectedAccessory = ref<AccessoryRecord | null>(null)
const searchExpanded = ref(false)
const searchKeyword = ref('')
const filters = ref<{ category?: string; brand_id?: number; model_name: string; color_id?: number }>({ model_name: '' })
const filterOptions = ref<Pick<AccessoryEntryOptions, 'categories' | 'brands' | 'colors'>>({ categories: [], brands: [], colors: [] })
const filterOptionsLoading = ref(false)
const filterOptionsError = ref('')
const filterOptionsRequest = useLatestRequest()
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
const getAccessoryModelDetails = (accessory: AccessoryRecord) => accessory.compatible_model_names ||
  [accessory.model_brand_name, accessory.model_name].filter(Boolean).join(' ') || '通用'
const getAccessoryModelSummary = (accessory: AccessoryRecord) => accessory.compatible_brand_names ||
  accessory.model_brand_name || (getAccessoryModelDetails(accessory) === '通用' ? '通用' : '已选型号')
const getAccessoryColors = (accessory: AccessoryRecord) => isTemplateMode.value && accessory.color_variants?.length
  ? accessory.color_variants.map(variant => variant.color_name || '-').join('、') : accessory.color_name || '-'
const getAccessoryBarcodes = (accessory: AccessoryRecord) => accessory.color_variants?.length
  ? accessory.color_variants.map(variant => `${canViewAccessoryField('color_name') ? `${variant.color_name || '-'}：` : ''}${variant.barcode || '未填写'}`).join('；') : accessory.barcode || '-'

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
  filters.value = { model_name: '' }
  listStatus.value = isTemplateMode.value ? 'all' : 1
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

const canDeleteUnusedBrandVariant = (accessory: AccessoryRecord) => (
  !isTemplateMode.value && Boolean(accessory.template_id) &&
  getTotalStock(accessory) === 0 && Number(accessory.total_out ?? 0) === 0
)

const formatPrice = (price?: number | string) => {
  return formatAmount(price)
}

const loadFilterOptions = async () => {
  if (!canView.value) return
  const request = filterOptionsRequest.nextRequest()
  filterOptionsLoading.value = true
  filterOptionsError.value = ''
  try {
    const response = await getAccessoryEntryOptions()
    if (!request.isLatest() || !canView.value) return
    const data = response.data
    if (!response.success || !data || ![data.categories, data.brands, data.colors].every(Array.isArray)) throw new Error('筛选选项响应无效')
    filterOptions.value = {
      categories: sortOptionsByOrder(data.categories), brands: sortOptionsByOrder(data.brands), colors: sortOptionsByOrder(data.colors)
    }
    return true
  } catch (err) {
    if (!request.isLatest() || filterOptionsRequest.isCanceledError(err)) return
    logger.error('加载商品筛选选项失败', err)
    filterOptionsError.value = getRequestErrorMessage(err, '筛选选项加载失败，请重试')
    return false
  } finally {
    if (request.isLatest()) filterOptionsLoading.value = false
  }
}

const loadAccessories = async (showLoadingState = true, preserveOnError = false): Promise<boolean | undefined> => {
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
        search: canViewAccessoryField('name') ? searchKeyword.value.trim() || undefined : undefined,
        category: canViewAccessoryField('category') ? filters.value.category || undefined : undefined,
        brand_id: canViewAccessoryField('brand_name') ? filters.value.brand_id || undefined : undefined,
        model_name: canViewAccessoryField('model_name') ? filters.value.model_name.trim() || undefined : undefined,
        color_id: canViewAccessoryField('color_name') ? filters.value.color_id || undefined : undefined,
        status: canViewAccessoryField('status') ? listStatus.value : undefined
      },
      signal: request.signal,
      showError: false,
      useCache: false
    })
    if (!request.isLatest()) return
    if (!response.success) throw new Error(response.message || '加载商品数据失败')
    accessories.value = response.data?.data || []
    total.value = Number(response.data?.pagination.total || 0)
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value
      return await loadAccessories(showLoadingState, preserveOnError)
    }
    return true
  } catch (err) {
    if (!request.isLatest() || isCanceledError(err)) return
    logger.error('加载配件数据失败', err)
    if (!preserveOnError) {
      accessories.value = []
      total.value = 0
    }
    error.value = '加载配件数据失败，请稍后重试'
    return false
  } finally {
    if (request.isLatest()) loading.value = false
  }
}

const handleSaved = async () => {
  selectedAccessory.value = null
  if (await loadAccessories(true, true) === false) {
    globalNotifications.warning('保存已成功，列表刷新失败，请点击刷新；请勿重复提交或入库。')
  }
}

const handleInventoryAdjusted = async () => {
  const accessoryId = selectedAccessory.value?.id
  if (!accessoryId || !canView.value) return
  const request = detailRefreshRequest.nextRequest()
  if (await loadAccessories(false, true) === false) {
    if (request.isLatest()) globalNotifications.warning('盘点已保存，列表刷新失败，请点击刷新；请勿重复提交。')
    return
  }
  if (!request.isLatest() || !canView.value || !showDetailsModal.value || selectedAccessory.value?.id !== accessoryId) return
  const updated = accessories.value.find(row => row.id === accessoryId)
  if (updated) selectedAccessory.value = updated
}

const handleRefresh = async () => {
  await refresh(async () => {
    const results = await Promise.all([loadAccessories(false, true), loadFilterOptions()])
    if (results.includes(false)) throw new Error('刷新商品列表或筛选选项失败')
  }, { successMessage: '数据刷新成功', errorMessage: '刷新失败，请重试' })
}

const openStockInModal = () => {
  if (!canStockIn.value) {
    handleNoPermission('stock-in')
    return
  }
  selectedAccessory.value = null
  stockEditOnlyModal.value = false
  profileEditOnlyModal.value = false
  stockInOnlyModal.value = false
  archiveOnlyModal.value = false
  showStockInModal.value = true
}

useRouteDialog({ path: '/accessories', flag: 'openStockIn', allowed: () => canView.value && canStockIn.value, open: openStockInModal })

const stockInAccessory = async (accessory: AccessoryRecord) => {
  if (!canStockIn.value) {
    handleNoPermission('stock-in')
    return
  }
  const request = templateEditRequest.nextRequest()
  try {
    const templateId = Number(accessory.id)
    const template = (await api.get<AccessoryRecord>(`/accessories/stock-in/templates/${templateId}`, {
      signal: request.signal, useCache: false
    })).data
    if (!request.isLatest() || !template?.id) return
    selectedAccessory.value = template
    stockEditOnlyModal.value = false
    profileEditOnlyModal.value = false
    archiveOnlyModal.value = false
    stockInOnlyModal.value = true
    showStockInModal.value = true
  } catch (err) {
    if (!request.isLatest() || templateEditRequest.isCanceledError(err)) return
    logger.error('读取入库商品模板失败', err)
    globalNotifications.error(getRequestErrorMessage(err, '读取入库商品失败，请重试'))
  }
}

const openArchiveModal = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }
  selectedAccessory.value = null
  stockEditOnlyModal.value = false
  profileEditOnlyModal.value = false
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
  if (!isTemplateMode.value) {
    templateEditRequest.cancelLatest()
    selectedAccessory.value = accessory
    stockEditOnlyModal.value = true
    profileEditOnlyModal.value = false
    stockInOnlyModal.value = false
    archiveOnlyModal.value = false
    showStockInModal.value = true
    return
  }
  stockEditOnlyModal.value = false
  profileEditOnlyModal.value = false
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

const editProductProfile = (accessory: AccessoryRecord) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
  templateEditRequest.cancelLatest()
  stockEditOnlyModal.value = false
  profileEditOnlyModal.value = true
  stockInOnlyModal.value = false
  archiveOnlyModal.value = false
  selectedAccessory.value = accessory
  showStockInModal.value = true
}

const deleteAccessory = async (accessory: AccessoryRecord) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    const targetName = canViewAccessoryField('name') ? accessory.name || '该配件' : '该配件'
    const removeUnusedVariant = canDeleteUnusedBrandVariant(accessory)
    const confirmMessage = removeUnusedVariant
      ? `确定删除 ${targetName} 吗？仅当无库存、无销售、无划拨且无历史关联时才会物理删除。存在任何业务关联时将保留商品档案。`
      : `确定删除 ${targetName} 吗？${isTemplateMode.value ? '删除将停用此模板，保留库存和历史单据；可在商品模板中编辑恢复启用。' : '该商品不满足空商品删除条件，将按停用处理并保留历史记录。'}`
    if (!await confirm(confirmMessage, isTemplateMode.value ? '删除商品模板' : '删除品牌商品', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })) return
  } catch {
    return
  }

  try {
    const removeUnusedVariant = canDeleteUnusedBrandVariant(accessory)
    const endpoint = removeUnusedVariant
      ? `/accessories/${accessory.id}/unused-variant`
      : `/accessories/${accessory.template_id || accessory.id}`
    await api.delete(endpoint, { showError: false })
    if (await loadAccessories(true, true) === false) {
      globalNotifications.warning(`${removeUnusedVariant ? '空品牌商品已删除' : '商品模板已删除（停用）'}，列表刷新失败，请点击刷新；请勿重复操作。`)
    } else {
      globalNotifications.success(removeUnusedVariant ? '空品牌商品已删除' : '商品模板已删除（停用），历史记录已保留')
    }
  } catch (err) {
    const message = getRequestErrorMessage(err, '删除失败，请重试')
    if (getRequestErrorStatus(err) === 409) {
      const warning = getRequestErrorCode(err) === 'ACCESSORY_DELETE_HAS_HISTORY'
        ? `${message} 如果是品牌填写错误，请点击“编辑档案”改为正确品牌，系统会在无业务活动时合并重复品牌商品。`
        : message
      globalNotifications.warning(warning)
      return
    }
    logger.error('删除配件失败', err)
    globalNotifications.error(message)
  }
}

const closeDetailsModal = () => {
  detailRefreshRequest.cancelLatest()
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
  await Promise.all([loadAccessories(), loadFilterOptions()])
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

usePageShortcuts('/accessories', {
  'goods-template-create': { open: openArchiveModal },
  'goods-stock': { open: () => switchMode('stock') },
  'goods-templates': { open: () => switchMode('templates') }
})
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
