<template>
  <div class="subsidy-list-section">
    <div class="table-section admin-panel admin-table-panel">
      <div class="section-title">
        <i class="fas fa-list" />
        国补申请列表
        <span class="record-count">共 {{ subsidyPagination?.total || 0 }} 条记录</span>
      </div>

      <div
        v-if="selectedItems.length > 0"
        class="batch-actions-bar"
      >
        <div class="batch-info">
          <i class="fas fa-check-square" />
          <span>已选择 <strong>{{ selectedItems.length }}</strong> 条记录</span>
        </div>
        <div class="batch-actions-buttons">
          <el-button
            type="success"
            size="small"
            :disabled="selectedItems.length === 0"
            @click="emit('pin-selected-items')"
          >
            <i class="fas fa-thumbtack" />
            <span>固定选中项 ({{ selectedItems.length }})</span>
          </el-button>
          <el-button
            v-if="pinnedItems.length > 0"
            type="warning"
            size="small"
            @click="emit('clear-pinned-items')"
          >
            <i class="fas fa-trash-alt" />
            <span>清除固定项 ({{ pinnedItems.length }})</span>
          </el-button>
          <el-button
            v-if="canBatchUpdate"
            type="primary"
            size="small"
            :disabled="selectedItems.length === 0"
            @click="emit('open-batch-dialog')"
          >
            <i class="fas fa-calendar-alt" />
            <span>批量修改时间</span>
          </el-button>
          <el-button
            size="small"
            @click="emit('clear-selection')"
          >
            <i class="fas fa-times" />
            <span>取消选择</span>
          </el-button>
        </div>
      </div>

      <div
        v-tf-loading="{ active: loading, text: '正在刷新国补记录...' }"
        class="table-container table-responsive"
      >
        <el-table
          v-if="!isMobile"
          :data="displayList"
          border
          stripe
          class="data-table devices-table subsidy-data-table"
          table-layout="fixed"
          :fit="true"
          row-key="id"
          :row-class-name="getTableRowClassName"
          @row-dblclick="(row) => emit('row-double-click', row)"
        >
          <template #empty>
            <TableLoadingRow
              v-if="loading && subsidyList.length === 0"
              mode="block"
              text="正在读取国补记录..."
            />
            <DataEmptyState
              v-else-if="displayList.length === 0"
              :state="subsidyList.length > 0 ? 'filtered' : 'empty'"
              :description="subsidyList.length > 0 ? '暂无匹配的国补申请记录' : '暂无国补申请记录'"
            />
          </template>
          <el-table-column
            width="54"
            align="center"
            class-name="selection-column"
          >
            <template #header>
              <el-checkbox
                :model-value="selectAll"
                :indeterminate="isIndeterminate"
                @click.stop
                @change="handleSelectAll"
              />
            </template>
            <template #default="{ row }">
              <el-checkbox
                :model-value="isSelectedItem(row.id)"
                @click.stop
                @change="(value) => emit('select-item', { id: row.id, checked: !!value })"
              />
            </template>
          </el-table-column>

          <el-table-column
            v-for="column in tableColumns"
            :key="column.key"
            :label="column.label"
            :min-width="getColumnMinWidth(column)"
            :class-name="getColumnClassName(column.key)"
            align="center"
            header-align="center"
          >
            <template #default="{ row }">
              <template v-if="column.key === 'store_name'">
                {{ row.store_name || '-' }}
              </template>
              <template v-else-if="column.key === 'sale_time'">
                {{ formatDate(row.sale_time) }}
              </template>

              <span
                v-else-if="column.key === 'customer_name'"
                class="clickable-text customer-info-toggle"
                :class="{
                  'has-handler-but-showing-purchaser': hasHandlerInfo(row) && !isShowingHandlerInfo(row),
                  'showing-handler': isShowingHandlerInfo(row)
                }"
                :title="hasHandlerInfo(row) ? (isShowingHandlerInfo(row) ? '点击切换到购买者' : '点击切换到办理人') : '点击复制'"
                @click.stop="hasHandlerInfo(row) ? toggleListItemCustomerInfo(row.id) : copyToClipboard(getDisplayInfo(row, 'name'), '姓名')"
              >{{ getDisplayInfo(row, 'name') || '-' }}</span>

              <span
                v-else-if="column.key === 'customer_phone'"
                class="clickable-text"
                title="点击复制"
                @click.stop="copyToClipboard(getDisplayInfo(row, 'phone'), '手机号')"
              >{{ getDisplayInfo(row, 'phone') || '-' }}</span>

              <template v-else-if="column.key === 'customer_idcard'">
                <span
                  v-if="getDisplayInfo(row, 'idcard') && canViewCustomerIdcard"
                  class="clickable-text"
                  title="点击复制"
                  @click.stop="copyToClipboard(getDisplayInfo(row, 'idcard'), '身份证号')"
                >{{ getDisplayInfo(row, 'idcard') }}</span>
                <span
                  v-else
                  class="text-muted"
                >-</span>
              </template>

              <template v-else-if="column.key === 'brand'">
                {{ row.phone_brand || '-' }}
              </template>
              <template v-else-if="column.key === 'model'">
                {{ row.phone_model || '-' }}
              </template>
              <template v-else-if="column.key === 'color'">
                {{ row.phone_color || '-' }}
              </template>
              <template v-else-if="column.key === 'memory'">
                {{ row.phone_memory || '-' }}
              </template>

              <span
                v-else-if="column.key === 'serial_number'"
                class="clickable-text qrcode-trigger"
                title="点击复制，悬停显示二维码"
                @click.stop="copyToClipboard(row.serial_number, '序列号')"
                @mouseenter="showQRCode($event, row.serial_number, '序列号')"
                @mouseleave="hideQRCode"
              >{{ row.serial_number || '-' }}</span>

              <span
                v-else-if="column.key === 'imei1'"
                class="clickable-text qrcode-trigger"
                title="点击复制，悬停显示二维码"
                @click.stop="copyToClipboard(row.imei1, 'IMEI1')"
                @mouseenter="showQRCode($event, row.imei1, 'IMEI1')"
                @mouseleave="hideQRCode"
              >{{ row.imei1 || '-' }}</span>

              <template v-else-if="column.key === 'imei2'">
                <span
                  v-if="row.imei2"
                  class="clickable-text qrcode-trigger"
                  title="点击复制，悬停显示二维码"
                  @click.stop="copyToClipboard(row.imei2, 'IMEI2')"
                  @mouseenter="showQRCode($event, row.imei2, 'IMEI2')"
                  @mouseleave="hideQRCode"
                >{{ row.imei2 }}</span>
                <span
                  v-else
                  class="text-muted"
                >-</span>
              </template>

              <span
                v-else-if="column.key === 'sale_price'"
                class="table-price sale-price"
              >¥{{ formatMoney(row.sale_price) }}</span>
              <span
                v-else-if="column.key === 'subsidy_amount'"
                class="table-price subsidy-price"
              >¥{{ formatMoney(getSubsidyFinalPrice(row)) }}</span>

              <template v-else-if="column.key === 'remarks'">
                <span
                  v-if="row.remarks"
                  class="remarks-tag"
                  :title="row.remarks"
                  @click.stop="copyRemarks(row.remarks)"
                >备注</span>
                <span
                  v-else
                  class="text-muted"
                >-</span>
              </template>

              <div
                v-else-if="column.key === 'subsidy_photos'"
                class="photo-icon-wrapper clickable"
                :title="canUpload ? (photoCount(row) > 0 ? '点击查看/管理国补照片' : '点击上传国补照片') : '点击查看国补照片'"
                @pointerenter="emit('preload-photo-manage', row)"
                @click.stop="emit('open-photo-manage', row)"
              >
                <template v-if="photoCount(row) > 0">
                  <i class="fas fa-images photo-icon" />
                  <span class="photo-count">{{ photoCount(row) }}</span>
                </template>
                <template v-else>
                  <i class="fas fa-image photo-icon-empty" />
                  <span class="upload-hint">图片</span>
                </template>
              </div>

              <template v-else-if="column.key === 'apply_time'">
                <div
                  v-if="hasApplyTime(row)"
                  class="time-badge approval-time"
                >
                  {{ formatDate(row.apply_time) }}
                </div>
                <el-button
                  v-else-if="canApprove"
                  type="primary"
                  size="small"
                  class="table-action table-action--manage table-inline-action"
                  title="审批"
                  @click.stop="emit('audit', row)"
                >
                  <i class="fas fa-clipboard-check" /><span class="btn-text">审批</span>
                </el-button>
                <span
                  v-else
                  class="text-muted"
                >-</span>
              </template>

              <template v-else-if="column.key === 'arrival_time'">
                <div
                  v-if="hasArrivalTime(row)"
                  class="time-badge arrival-time"
                >
                  {{ formatDate(row.arrival_time) }}
                </div>
                <el-button
                  v-else-if="canArrival"
                  type="success"
                  size="small"
                  class="table-action table-action--finance table-inline-action"
                  title="到账"
                  @click.stop="emit('confirm-arrival', row)"
                >
                  <i class="fas fa-hand-holding-usd" /><span class="btn-text">到账</span>
                </el-button>
                <span
                  v-else
                  class="text-muted"
                >-</span>
              </template>

              <div
                v-else-if="column.key === 'actions'"
                class="action-buttons"
              >
                <el-button
                  v-if="canEdit"
                  type="primary"
                  size="small"
                  class="table-action table-action--edit"
                  title="编辑"
                  @click.stop="emit('edit', row)"
                >
                  <i class="fas fa-edit" /><span class="btn-text">编辑</span>
                </el-button>
                <el-button
                  v-if="canDelete"
                  type="danger"
                  size="small"
                  class="table-action table-action--delete"
                  title="删除"
                  @click.stop="emit('delete', row)"
                >
                  <i class="fas fa-trash-alt" /><span class="btn-text">删除</span>
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <TableLoadingRow
          v-else-if="loading && subsidyList.length === 0"
          mode="block"
          text="正在读取国补记录..."
        />
        <DataEmptyState
          v-else-if="subsidyList.length === 0"
          description="暂无国补申请记录"
        />
        <div
          v-else
          class="mobile-card-list"
        >
          <div
            v-for="item in displayList"
            :key="item.id"
            class="mobile-subsidy-card"
            :class="{ 'selected-row': isSelectedItem(item.id), 'pinned-row': isPinnedItem(item.id) }"
            @click="emit('row-double-click', item)"
          >
            <div class="mobile-card-accent" />
            <div class="mobile-card-shell">
              <div
                class="mobile-select-cell"
                @click.stop
              >
                <el-checkbox
                  :model-value="isSelectedItem(item.id)"
                  @click.stop
                  @change="(value) => emit('select-item', { id: item.id, checked: !!value })"
                />
              </div>

              <div class="mobile-card-content">
                <div class="mobile-card-head">
                  <div class="mobile-meta-line">
                    <span
                      v-if="fieldVisibility.sale_time"
                      class="mobile-date"
                    >{{ formatDate(item.sale_time) }}</span>
                    <span
                      v-if="fieldVisibility.store_name"
                      class="mobile-store"
                    >{{ item.store_name || '-' }}</span>
                  </div>
                  <span
                    v-if="fieldVisibility.has_different_handler && isHandlerSubsidy(item)"
                    class="mobile-handler-badge"
                  >代办</span>
                </div>

                <div class="mobile-device-line">
                  <span
                    v-if="fieldVisibility.brand"
                    class="mobile-brand-text"
                  >
                    {{ item.phone_brand || '-' }}
                  </span>
                  <span
                    v-if="fieldVisibility.model"
                    class="mobile-model-title"
                  >
                    {{ item.phone_model || '-' }}
                  </span>
                  <span
                    v-if="fieldVisibility.color"
                    class="mobile-spec-text"
                  >
                    {{ item.phone_color || '颜色-' }}
                  </span>
                  <span
                    v-if="fieldVisibility.memory"
                    class="mobile-spec-text"
                  >
                    {{ item.phone_memory || '内存-' }}
                  </span>
                </div>

                <div class="mobile-person-line">
                  <span
                    v-if="fieldVisibility.customer_name"
                    class="mobile-name"
                  >
                    <i class="fas fa-user" />
                    {{ getDisplayInfo(item, 'name') || '-' }}
                  </span>
                  <span
                    v-if="fieldVisibility.customer_phone"
                    class="mobile-phone"
                  >
                    <i class="fas fa-phone-alt" />
                    {{ getDisplayInfo(item, 'phone') || '-' }}
                  </span>
                  <span
                    v-if="fieldVisibility.sale_price"
                    class="mobile-price"
                  >
                    ¥{{ formatMoney(item.sale_price) }}
                  </span>
                </div>

                <div
                  v-if="fieldVisibility.apply_time || canApprove || fieldVisibility.arrival_time || canArrival"
                  class="mobile-workflow-fields"
                  @click.stop
                >
                  <div
                    v-if="fieldVisibility.apply_time || canApprove"
                    class="mobile-workflow-field"
                  >
                    <span class="mobile-workflow-label">提交</span>
                    <span
                      v-if="hasApplyTime(item)"
                      class="mobile-action-status is-approved"
                    >{{ formatDate(item.apply_time) }}</span>
                    <el-button
                      v-else-if="canApprove"
                      type="primary"
                      size="small"
                      class="table-action table-action--manage table-inline-action"
                      title="审批"
                      @click.stop="emit('audit', item)"
                    >
                      审批
                    </el-button>
                    <span
                      v-else
                      class="text-muted"
                    >-</span>
                  </div>

                  <div
                    v-if="fieldVisibility.arrival_time || canArrival"
                    class="mobile-workflow-field"
                  >
                    <span class="mobile-workflow-label">到账</span>
                    <span
                      v-if="hasArrivalTime(item)"
                      class="mobile-action-status is-arrived"
                    >{{ formatDate(item.arrival_time) }}</span>
                    <el-button
                      v-else-if="canArrival"
                      type="success"
                      size="small"
                      class="table-action table-action--finance table-inline-action"
                      title="到账"
                      @click.stop="emit('confirm-arrival', item)"
                    >
                      到账
                    </el-button>
                    <span
                      v-else
                      class="text-muted"
                    >-</span>
                  </div>
                </div>

                <div
                  v-if="fieldVisibility.subsidy_photos || canUpload || canEdit || canDelete"
                  class="mobile-card-actions"
                  @click.stop
                >
                  <el-button
                    v-if="fieldVisibility.subsidy_photos || canUpload"
                    native-type="button"
                    class="mobile-action-mark mobile-photo-action"
                    :class="{ 'has-photos': photoCount(item) > 0 }"
                    :title="canUpload ? (photoCount(item) > 0 ? '查看/管理国补照片' : '上传国补照片') : '查看国补照片'"
                    @pointerenter="emit('preload-photo-manage', item)"
                    @focus="emit('preload-photo-manage', item)"
                    @click.stop="emit('open-photo-manage', item)"
                  >
                    <i :class="photoCount(item) > 0 ? 'fas fa-images' : 'far fa-image'" />
                    <span
                      v-if="photoCount(item) > 0"
                      class="mobile-photo-count"
                    >{{ photoCount(item) }}</span>
                  </el-button>
                  <el-button
                    v-if="canEdit"
                    type="primary"
                    size="small"
                    class="table-action table-action--edit"
                    @click.stop="emit('edit', item)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    type="danger"
                    size="small"
                    class="table-action table-action--delete"
                    @click.stop="emit('delete', item)"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="qrCodeVisible"
          class="qrcode-tooltip"
          :style="qrCodePosition"
          @mouseenter="keepQRCodeVisible"
          @mouseleave="hideQRCode"
        >
          <div
            class="qrcode-meta"
            :class="qrCodeTitle === '序列号' ? 'is-serial' : 'is-imei'"
          >
            <span class="qrcode-title">{{ qrCodeTitle }}</span>
            <span class="qrcode-value">{{ qrCodeValue }}</span>
          </div>
          <canvas ref="qrCodeCanvas" />
        </div>
      </div>

      <PaginationComponent
        v-if="subsidyPagination && subsidyPagination.total > 0"
        :current="subsidyPagination.page"
        :page-size="subsidyPagination.page_size"
        :total="subsidyPagination.total"
        :page-sizes="[20, 50, 100, 200]"
        :show-total="true"
        :show-range="true"
        :show-page-sizes="true"
        :show-quick-jumper="true"
        @update:current="(page) => emit('page-change', page)"
        @update:page-size="(page_size) => emit('page-size-change', page_size)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import PaginationComponent from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { logger } from '@/utils/logger'
import { getActionColumnMinWidth, getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { formatAmount, formatDate } from '@/utils/format'
import type { NationalSubsidyRecord } from '@/types'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


interface TableColumn {
  key: string
  label: string
}

interface PaginationState {
  page: number
  page_size: number
  total: number
  total_pages?: number
}

const props = defineProps<{
  loading: boolean
  subsidyList: NationalSubsidyRecord[]
  displayList: NationalSubsidyRecord[]
  tableColumns: TableColumn[]
  fieldVisibility: Record<string, boolean>
  isMobile: boolean
  selectedItems: number[]
  pinnedItems: NationalSubsidyRecord[]
  subsidyPagination: PaginationState
  canApprove: boolean
  canArrival: boolean
  canUpload: boolean
  canEdit: boolean
  canDelete: boolean
  canShowActions: boolean
  canViewCustomerIdcard: boolean
  selectAll: boolean
  isIndeterminate: boolean
}>()

const emit = defineEmits<{
  'select-all': [boolean]
  'select-item': [{ id: number, checked: boolean }]
  'row-double-click': [NationalSubsidyRecord]
  'pin-selected-items': []
  'clear-pinned-items': []
  'open-batch-dialog': []
  'clear-selection': []
  'preload-photo-manage': [NationalSubsidyRecord]
  'open-photo-manage': [NationalSubsidyRecord]
  'audit': [NationalSubsidyRecord]
  'confirm-arrival': [NationalSubsidyRecord]
  'edit': [NationalSubsidyRecord]
  'delete': [NationalSubsidyRecord]
  'page-change': [number]
  'page-size-change': [number]
}>()

const handlerInfoVisibility = ref<Map<number, boolean>>(new Map())
const canBatchUpdate = computed(() => (
  props.canApprove || props.canArrival
))
const qrCodeVisible = ref(false)
const qrCodePosition = ref({ top: '0px', left: '0px' })
const qrCodeTitle = ref('')
const qrCodeValue = ref('')
const qrCodeCanvas = ref<HTMLCanvasElement | null>(null)

let qrCodeHideTimer: ReturnType<typeof setTimeout> | null = null
let qrCodeRenderTimer: ReturnType<typeof setTimeout> | null = null
let qrCodeRenderToken = 0

const selectedItemIdSet = computed(() => new Set(props.selectedItems))
const pinnedItemIdSet = computed(() => new Set(props.pinnedItems.map(item => item.id)))

const columnBaseWidths: Record<string, number> = {
  store_name: 54,
  sale_time: 82,
  customer_name: 54,
  customer_phone: 92,
  customer_idcard: 138,
  brand: 54,
  model: 64,
  color: 52,
  memory: 60,
  serial_number: 96,
  imei1: 112,
  imei2: 112,
  sale_price: 68,
  subsidy_amount: 76,
  remarks: 54,
  subsidy_photos: 72,
  apply_time: 76,
  arrival_time: 76
}

const getColumnValue = (row: NationalSubsidyRecord, key: string) => {
  const valueMap: Record<string, unknown> = {
    store_name: row.store_name,
    sale_time: formatDate(row.sale_time),
    customer_name: getDisplayInfo(row, 'name'),
    customer_phone: getDisplayInfo(row, 'phone'),
    customer_idcard: getDisplayInfo(row, 'idcard'),
    brand: row.phone_brand,
    model: row.phone_model,
    color: row.phone_color,
    memory: row.phone_memory,
    serial_number: row.serial_number,
    imei1: row.imei1,
    imei2: row.imei2,
    sale_price: `¥${formatMoney(row.sale_price)}`,
    subsidy_amount: `¥${formatMoney(getSubsidyFinalPrice(row))}`,
    remarks: row.remarks ? '备注' : '-',
    subsidy_photos: photoCount(row) > 0 ? String(photoCount(row)) : '图片',
    apply_time: hasApplyTime(row) ? formatDate(row.apply_time) : (props.canApprove ? '审批' : '-'),
    arrival_time: hasArrivalTime(row) ? formatDate(row.arrival_time) : (props.canArrival ? '到账' : '-')
  }
  return valueMap[key] as string | number | null | undefined
}

const getColumnMinWidth = (column: TableColumn) => {
  if (column.key === 'actions') {
    const actionCount = Number(props.canEdit) + Number(props.canDelete)
    return getActionColumnMinWidth(actionCount)
  }

  const values: Array<string | number | null | undefined> = [
    column.label,
    ...props.displayList.map(row => getColumnValue(row, column.key))
  ]

  // 姓名、电话、身份证可以切换为办理人，隐藏状态下也要为完整内容预留宽度。
  if (column.key === 'customer_name') {
    values.push(...props.displayList.map(row => row?.handler_info?.handler_name))
  } else if (column.key === 'customer_phone') {
    values.push(...props.displayList.map(row => row?.handler_info?.handler_phone))
  } else if (column.key === 'customer_idcard') {
    values.push(...props.displayList.map(row => row?.handler_info?.handler_idcard))
  }

  const minWidth = columnBaseWidths[column.key] || 88
  const horizontalPadding = ['apply_time', 'arrival_time'].includes(column.key) ? 32 : 24
  const options = {
    minWidth,
    horizontalPadding,
    asciiCharacterWidth: 7.5
  }

  if (['customer_idcard', 'serial_number', 'imei1', 'imei2'].includes(column.key)) {
    return getIdentifierColumnMinWidth(values, options)
  }

  const contentWidth = getTextColumnMinWidth(values, options)
  if (column.key === 'apply_time' && props.canApprove) {
    return Math.max(contentWidth, getActionColumnMinWidth(['审批'], { minWidth, horizontalPadding: 16 }))
  }
  if (column.key === 'arrival_time' && props.canArrival) {
    return Math.max(contentWidth, getActionColumnMinWidth(['到账'], { minWidth, horizontalPadding: 16 }))
  }

  return contentWidth
}

const getColumnClassName = (key: string) => {
  if (['customer_idcard', 'serial_number', 'imei1', 'imei2'].includes(key)) {
    return 'identifier-column'
  }
  if (key === 'actions') return 'actions-column'
  if (key === 'subsidy_photos') return 'complete-text-column subsidy-photo-cell'
  return 'complete-text-column'
}

const getTableRowClassName = ({ row }: { row: NationalSubsidyRecord }) => [
  isSelectedItem(row.id) ? 'row-selected' : '',
  isPinnedItem(row.id) ? 'pinned-row' : ''
].filter(Boolean).join(' ')

const handleSelectAll = (value: boolean | string | number) => {
  emit('select-all', Boolean(value))
}

const isSelectedItem = (id: number) => selectedItemIdSet.value.has(id)
const isPinnedItem = (id: number) => pinnedItemIdSet.value.has(id)

const formatMoney = (value: unknown) => {
  return formatAmount(value as number | string | null | undefined)
}

const getSubsidyFinalPrice = (item: NationalSubsidyRecord) => {
  return Number(item?.sale_price || 0) - Number(item?.subsidy_amount || 0)
}

const hasApplyTime = (item: NationalSubsidyRecord) => Boolean(item.apply_time && item.apply_time !== '')
const hasArrivalTime = (item: NationalSubsidyRecord) => Boolean(item.arrival_time && item.arrival_time !== '')
const photoCount = (item: NationalSubsidyRecord) => item.subsidy_photos?.length || 0
const isHandlerSubsidy = (item: NationalSubsidyRecord) => Boolean(item.has_different_handler)

const toggleListItemCustomerInfo = (itemId: number) => {
  const currentState = handlerInfoVisibility.value.get(itemId) || false
  handlerInfoVisibility.value.set(itemId, !currentState)
}

const getDisplayInfo = (item: NationalSubsidyRecord, field: 'name' | 'phone' | 'idcard') => {
  const showHandler = handlerInfoVisibility.value.get(item.id) || false
  const handler_info = item?.handler_info

  if (showHandler && item?.has_different_handler && handler_info) {
    switch (field) {
    case 'name':
      return props.fieldVisibility.handler_name ? handler_info.handler_name : item?.customer_name
    case 'phone':
      return props.fieldVisibility.handler_phone ? handler_info.handler_phone : item?.customer_phone
    case 'idcard':
      return props.fieldVisibility.handler_idcard ? handler_info.handler_idcard : item?.customer_idcard
    }
  }

  switch (field) {
  case 'name':
    return item?.customer_name
  case 'phone':
    return item?.customer_phone
  case 'idcard':
    return item?.customer_idcard
  }
}

const hasHandlerInfo = (item: NationalSubsidyRecord) => (
  props.fieldVisibility.has_different_handler &&
  item.has_different_handler &&
  item.handler_info &&
  (props.fieldVisibility.handler_name || props.fieldVisibility.handler_phone || props.fieldVisibility.handler_idcard)
)
const isShowingHandlerInfo = (item: NationalSubsidyRecord) => handlerInfoVisibility.value.get(item.id) || false

const copyToClipboard = async (text: string | null | undefined, label: string) => {
  const copyText = text || ''
  if (!copyText) {
    globalNotifications.warning(`暂无可复制的${label}`)
    return
  }
  const closeLoading = globalNotifications.loading('正在复制...')

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(copyText)
      closeLoading()
      globalNotifications.success(`${label}已复制`)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = copyText
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    try {
      const successful = document.execCommand('copy')
      closeLoading()
      if (successful) {
        globalNotifications.success(`${label}已复制`)
      } else {
        globalNotifications.error('复制失败')
      }
    } catch {
      closeLoading()
      globalNotifications.error('复制失败')
    } finally {
      document.body.removeChild(textarea)
    }
  } catch (error) {
    closeLoading()
    logger.error('复制失败:', error)
    globalNotifications.error('复制失败')
  }
}

const copyRemarks = async (remarks: string) => {
  try {
    await navigator.clipboard.writeText(remarks)
    globalNotifications.success('备注已复制')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = remarks
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      globalNotifications.success('备注已复制')
    } catch {
      globalNotifications.error('复制失败')
    }
    document.body.removeChild(textarea)
  }
}

const clearQrTimers = () => {
  if (qrCodeHideTimer) {
    clearTimeout(qrCodeHideTimer)
    qrCodeHideTimer = null
  }

  if (qrCodeRenderTimer) {
    clearTimeout(qrCodeRenderTimer)
    qrCodeRenderTimer = null
  }
}

const showQRCode = (event: MouseEvent, value: string, title: string) => {
  clearQrTimers()

  qrCodeValue.value = value
  qrCodeTitle.value = title
  qrCodeVisible.value = true

  const target = event.target as HTMLElement
  const rect = target.getBoundingClientRect()
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
  const tooltipHeight = 270
  const tooltipWidth = 252
  const gap = 10
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top

  const top = spaceBelow < tooltipHeight && spaceAbove > spaceBelow
    ? `${rect.top + scrollTop - tooltipHeight - gap}px`
    : `${rect.bottom + scrollTop + gap}px`

  let leftPos = rect.left + scrollLeft
  if (leftPos + tooltipWidth > window.innerWidth) {
    leftPos = window.innerWidth - tooltipWidth - scrollLeft - 20
  }

  qrCodePosition.value = {
    top,
    left: `${Math.max(10, leftPos)}px`
  }

  const currentToken = ++qrCodeRenderToken
  qrCodeRenderTimer = setTimeout(async () => {
    qrCodeRenderTimer = null
    await generateQRCode(value, currentToken)
  }, 220)
}

const hideQRCode = () => {
  if (qrCodeRenderTimer) {
    clearTimeout(qrCodeRenderTimer)
    qrCodeRenderTimer = null
  }

  qrCodeHideTimer = setTimeout(() => {
    qrCodeVisible.value = false
  }, 200)
}

const keepQRCodeVisible = () => {
  if (qrCodeHideTimer) {
    clearTimeout(qrCodeHideTimer)
    qrCodeHideTimer = null
  }
}

const generateQRCode = async (text: string, renderToken: number) => {
  const canvas = qrCodeCanvas.value
  if (!canvas) return

  try {
    const { default: QRCode } = await import('qrcode')
    if (renderToken !== qrCodeRenderToken || !qrCodeVisible.value || qrCodeValue.value !== text) {
      return
    }

    await QRCode.toCanvas(canvas, text, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
  } catch (error) {
    logger.error('二维码生成失败:', error)
  }
}

watch(
  () => props.displayList.map(item => item.id).join(','),
  () => {
    const nextState = new Map<number, boolean>()
    for (const item of props.displayList) {
      const currentValue = handlerInfoVisibility.value.get(item.id)
      if (currentValue !== undefined) {
        nextState.set(item.id, currentValue)
      }
    }
    handlerInfoVisibility.value = nextState
  },
  { immediate: true }
)

onUnmounted(() => {
  clearQrTimers()
})
</script>

<style scoped lang="scss" src="./styles/subsidy-list/table-and-photos.scss"></style>
<style scoped lang="scss" src="./styles/subsidy-list/mobile-card.scss"></style>
<style scoped lang="scss" src="./styles/subsidy-list/mobile-actions.scss"></style>
