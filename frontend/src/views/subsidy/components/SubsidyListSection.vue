<template>
  <div class="subsidy-list-section">
    <div class="table-section admin-panel admin-table-panel">
      <div class="section-title">
        <i class="fas fa-list"></i>
        国补申请列表
        <span class="record-count">共 {{ subsidyPagination?.total || 0 }} 条记录</span>
      </div>

      <div v-if="selectedItems.length > 0" class="batch-actions-bar">
        <div class="batch-info">
          <i class="fas fa-check-square"></i>
          <span>已选择 <strong>{{ selectedItems.length }}</strong> 条记录</span>
        </div>
        <div class="batch-actions-buttons">
          <el-button
            type="success"
            size="small"
            :disabled="selectedItems.length === 0"
            @click="emit('pin-selected-items')"
          >
            <i class="fas fa-thumbtack"></i>
            <span>固定选中项 ({{ selectedItems.length }})</span>
          </el-button>
          <el-button
            v-if="pinnedItems.length > 0"
            type="warning"
            size="small"
            @click="emit('clear-pinned-items')"
          >
            <i class="fas fa-trash-alt"></i>
            <span>清除固定项 ({{ pinnedItems.length }})</span>
          </el-button>
          <el-button
            type="primary"
            size="small"
            :disabled="selectedItems.length === 0"
            @click="emit('open-batch-dialog')"
          >
            <i class="fas fa-calendar-alt"></i>
            <span>批量修改时间</span>
          </el-button>
          <el-button
            size="small"
            @click="emit('clear-selection')"
          >
            <i class="fas fa-times"></i>
            <span>取消选择</span>
          </el-button>
        </div>
      </div>

      <div class="table-container table-responsive">
        <TableLoadingRow v-if="loading" mode="block" text="加载中..." />

        <div v-else-if="subsidyList.length === 0" class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>暂无国补申请记录</p>
        </div>

        <el-table
          v-else-if="!isMobile"
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
          <el-table-column width="54" align="center" class-name="selection-column">
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
              <template v-if="column.key === 'store_name'">{{ row.store_name || '-' }}</template>
              <template v-else-if="column.key === 'sale_time'">{{ formatDate(row.sale_time) }}</template>

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
                <span v-else class="text-muted">-</span>
              </template>

              <template v-else-if="column.key === 'brand'">{{ row.phone_brand || '-' }}</template>
              <template v-else-if="column.key === 'model'">{{ row.phone_model || '-' }}</template>
              <template v-else-if="column.key === 'color'">{{ row.phone_color || '-' }}</template>
              <template v-else-if="column.key === 'memory'">{{ row.phone_memory || '-' }}</template>

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
                <span v-else class="text-muted">-</span>
              </template>

              <span v-else-if="column.key === 'sale_price'" class="table-price sale-price">¥{{ formatMoney(row.sale_price) }}</span>
              <span v-else-if="column.key === 'subsidy_amount'" class="table-price subsidy-price">¥{{ formatMoney(getSubsidyFinalPrice(row)) }}</span>

              <template v-else-if="column.key === 'remarks'">
                <span v-if="row.remarks" class="remarks-tag" :title="row.remarks" @click.stop="copyRemarks(row.remarks)">备注</span>
                <span v-else class="text-muted">-</span>
              </template>

              <div
                v-else-if="column.key === 'subsidy_photos'"
                class="photo-icon-wrapper clickable"
                :title="photoCount(row) > 0 ? '点击查看/管理国补照片' : '点击上传国补照片'"
                @click.stop="emit('open-photo-manage', row)"
              >
                <template v-if="photoCount(row) > 0">
                  <i class="fas fa-images photo-icon"></i>
                  <span class="photo-count">{{ photoCount(row) }}</span>
                </template>
                <template v-else>
                  <i class="fas fa-image photo-icon-empty"></i>
                  <span class="upload-hint">图片</span>
                </template>
              </div>

              <template v-else-if="column.key === 'apply_time'">
                <div v-if="hasApplyTime(row)" class="time-badge approval-time">
                  {{ formatDate(row.apply_time) }}
                </div>
                <el-button v-else-if="canApprove" type="primary" size="small" class="table-action table-action--manage table-inline-action" title="审批" @click.stop="emit('audit', row)">
                  <i class="fas fa-clipboard-check"></i><span>审批</span>
                </el-button>
              </template>

              <template v-else-if="column.key === 'arrival_time'">
                <div v-if="hasArrivalTime(row)" class="time-badge arrival-time">
                  {{ formatDate(row.arrival_time) }}
                </div>
                <el-button v-else-if="canEdit" type="success" size="small" class="table-action table-action--finance table-inline-action" title="到账" @click.stop="emit('confirm-arrival', row)">
                  <i class="fas fa-hand-holding-usd"></i><span>到账</span>
                </el-button>
              </template>

              <div v-else-if="column.key === 'actions'" class="action-buttons">
                <el-button v-if="canEdit" type="primary" size="small" class="table-action table-action--edit" title="编辑" @click.stop="emit('edit', row)">
                  <i class="fas fa-edit"></i><span class="btn-text">编辑</span>
                </el-button>
                <el-button v-if="canDelete" type="danger" size="small" class="table-action table-action--delete" title="删除" @click.stop="emit('delete', row)">
                  <i class="fas fa-trash-alt"></i><span class="btn-text">删除</span>
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div v-else class="mobile-card-list">
          <div
            v-for="item in displayList"
            :key="item.id"
            v-memo="[item, isSelectedItem(item.id), isPinnedItem(item.id), isShowingHandlerInfo(item)]"
            class="mobile-subsidy-card"
            :class="{ 'selected-row': isSelectedItem(item.id), 'pinned-row': isPinnedItem(item.id) }"
            @click="emit('row-double-click', item)"
          >
            <div class="mobile-card-accent"></div>
            <div class="mobile-card-shell">
              <div class="mobile-select-cell" @click.stop>
                <el-checkbox
                  :model-value="isSelectedItem(item.id)"
                  @click.stop
                  @change="(value) => emit('select-item', { id: item.id, checked: !!value })"
                />
              </div>

              <div class="mobile-card-content">
                <div class="mobile-card-head">
                  <div class="mobile-meta-line">
                    <span v-if="fieldVisibility.saleTime" class="mobile-date">{{ formatDate(item.sale_time) }}</span>
                    <span v-if="fieldVisibility.storeName" class="mobile-store">{{ item.store_name || '-' }}</span>
                  </div>
                  <span v-if="isHandlerSubsidy(item)" class="mobile-handler-badge">代办</span>
                </div>

                <div class="mobile-device-line">
                  <span v-if="fieldVisibility.brand" class="mobile-brand-text">
                    {{ item.phone_brand || '-' }}
                  </span>
                  <span v-if="fieldVisibility.model" class="mobile-model-title">
                    {{ item.phone_model || '-' }}
                  </span>
                  <span v-if="fieldVisibility.color" class="mobile-spec-text">
                    {{ item.phone_color || '颜色-' }}
                  </span>
                  <span v-if="fieldVisibility.memory" class="mobile-spec-text">
                    {{ item.phone_memory || '内存-' }}
                  </span>
                </div>

                <div class="mobile-person-line">
                  <span v-if="fieldVisibility.customerName" class="mobile-name">
                    <i class="fas fa-user"></i>
                    {{ getDisplayInfo(item, 'name') || '-' }}
                  </span>
                  <span v-if="fieldVisibility.customerPhone" class="mobile-phone">
                    <i class="fas fa-phone-alt"></i>
                    {{ getDisplayInfo(item, 'phone') || '-' }}
                  </span>
                  <span v-if="fieldVisibility.salePrice" class="mobile-price">
                    ¥{{ formatMoney(item.sale_price) }}
                  </span>
                  <span v-else-if="fieldVisibility.subsidyAmount" class="mobile-price mobile-price--subsidy">
                    补后 ¥{{ formatMoney(getSubsidyFinalPrice(item)) }}
                  </span>
                </div>

                <div class="mobile-card-actions" @click.stop>
                  <button
                    type="button"
                    class="mobile-action-mark mobile-photo-action"
                    :class="{ 'has-photos': photoCount(item) > 0 }"
                    :title="photoCount(item) > 0 ? '查看/管理国补照片' : '上传国补照片'"
                    @click.stop="emit('open-photo-manage', item)"
                  >
                    <i :class="photoCount(item) > 0 ? 'fas fa-images' : 'far fa-image'"></i>
                    <span v-if="photoCount(item) > 0" class="mobile-photo-count">{{ photoCount(item) }}</span>
                  </button>
                  <el-button
                    v-if="fieldVisibility.applyTime && canApprove && !hasApplyTime(item)"
                    type="primary"
                    size="small"
                    class="table-action table-action--manage table-inline-action"
                    title="审批"
                    @click.stop="emit('audit', item)"
                  >
                    审批
                  </el-button>
                  <span
                    v-else-if="fieldVisibility.applyTime"
                    class="mobile-action-status"
                    :class="hasApplyTime(item) ? 'is-approved' : 'is-pending'"
                  >
                    {{ hasApplyTime(item) ? '已审' : '待审' }}
                  </span>
                  <el-button
                    v-if="fieldVisibility.arrivalTime && canEdit && !hasArrivalTime(item)"
                    type="success"
                    size="small"
                    class="table-action table-action--finance table-inline-action"
                    title="到账"
                    @click.stop="emit('confirm-arrival', item)"
                  >
                    到账
                  </el-button>
                  <span
                    v-else-if="fieldVisibility.arrivalTime"
                    class="mobile-action-status"
                    :class="hasArrivalTime(item) ? 'is-arrived' : 'is-waiting'"
                  >
                    {{ hasArrivalTime(item) ? '已到' : '待到' }}
                  </span>
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
          <canvas ref="qrCodeCanvas"></canvas>
        </div>
      </div>

      <PaginationComponent
        v-if="subsidyPagination && subsidyPagination.total > 0"
        :current="subsidyPagination.current"
        :page-size="subsidyPagination.pageSize"
        :total="subsidyPagination.total"
        :page-sizes="[20, 50, 100, 200]"
        :show-total="true"
        :show-range="true"
        :show-page-sizes="true"
        :show-quick-jumper="true"
        @update:current="(page) => emit('page-change', page)"
        @update:pageSize="(pageSize) => emit('page-size-change', pageSize)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import PaginationComponent from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'
import { getActionColumnMinWidth, getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { formatAmount } from '@/utils/format'

interface TableColumn {
  key: string
  label: string
}

interface PaginationState {
  current: number
  pageSize: number
  total: number
  totalPages?: number
}

const props = defineProps<{
  loading: boolean
  subsidyList: any[]
  displayList: any[]
  tableColumns: TableColumn[]
  fieldVisibility: Record<string, boolean>
  isMobile: boolean
  selectedItems: number[]
  pinnedItems: any[]
  subsidyPagination: PaginationState
  canApprove: boolean
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
  'row-double-click': [any]
  'pin-selected-items': []
  'clear-pinned-items': []
  'open-batch-dialog': []
  'clear-selection': []
  'open-photo-manage': [any]
  'audit': [any]
  'confirm-arrival': [any]
  'edit': [any]
  'delete': [any]
  'page-change': [number]
  'page-size-change': [number]
}>()

const handlerInfoVisibility = ref<Map<number, boolean>>(new Map())
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

const getColumnValue = (row: any, key: string) => {
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
    apply_time: hasApplyTime(row) ? formatDate(row.apply_time) : '审批',
    arrival_time: hasArrivalTime(row) ? formatDate(row.arrival_time) : '到账'
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
    values.push(...props.displayList.map(row => row?.handlerInfo?.handlerName))
  } else if (column.key === 'customer_phone') {
    values.push(...props.displayList.map(row => row?.handlerInfo?.handlerPhone))
  } else if (column.key === 'customer_idcard') {
    values.push(...props.displayList.map(row => row?.handlerInfo?.handlerIdcard))
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

  return getTextColumnMinWidth(values, options)
}

const getColumnClassName = (key: string) => {
  if (['customer_idcard', 'serial_number', 'imei1', 'imei2'].includes(key)) {
    return 'identifier-column'
  }
  if (key === 'actions') return 'actions-column'
  if (key === 'subsidy_photos') return 'complete-text-column subsidy-photo-cell'
  return 'complete-text-column'
}

const getTableRowClassName = ({ row }: { row: any }) => [
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

const getSubsidyFinalPrice = (item: any) => {
  return Number(item?.sale_price || 0) - Number(item?.subsidy_amount || 0)
}

const hasApplyTime = (item: any) => Boolean(item?.apply_time && item.apply_time !== '')
const hasArrivalTime = (item: any) => Boolean(item?.arrival_time && item.arrival_time !== '')
const photoCount = (item: any) => Array.isArray(item?.subsidy_photos) ? item.subsidy_photos.length : 0
const isHandlerSubsidy = (item: any) => Boolean(item?.hasDifferentHandler)

const toggleListItemCustomerInfo = (itemId: number) => {
  const currentState = handlerInfoVisibility.value.get(itemId) || false
  handlerInfoVisibility.value.set(itemId, !currentState)
}

const getDisplayInfo = (item: any, field: 'name' | 'phone' | 'idcard') => {
  const showHandler = handlerInfoVisibility.value.get(item.id) || false
  const handlerInfo = item?.handlerInfo

  if (showHandler && item?.hasDifferentHandler && handlerInfo) {
    switch (field) {
      case 'name':
        return handlerInfo.handlerName
      case 'phone':
        return handlerInfo.handlerPhone
      case 'idcard':
        return handlerInfo.handlerIdcard
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

const hasHandlerInfo = (item: any) => item.hasDifferentHandler && item.handlerInfo
const isShowingHandlerInfo = (item: any) => handlerInfoVisibility.value.get(item.id) || false

const copyToClipboard = async (text: string, label: string) => {
  const loadingMsg = ElMessage.info({
    message: '正在复制...',
    duration: 0
  })

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      loadingMsg.close()
      ElMessage.success(`${label}已复制`)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    try {
      const successful = document.execCommand('copy')
      loadingMsg.close()
      if (successful) {
        ElMessage.success(`${label}已复制`)
      } else {
        ElMessage.error('复制失败')
      }
    } catch {
      loadingMsg.close()
      ElMessage.error('复制失败')
    } finally {
      document.body.removeChild(textarea)
    }
  } catch (error) {
    loadingMsg.close()
    logger.error('复制失败:', error)
    ElMessage.error('复制失败')
  }
}

const copyRemarks = async (remarks: string) => {
  try {
    await navigator.clipboard.writeText(remarks)
    ElMessage.success('备注已复制')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = remarks
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      ElMessage.success('备注已复制')
    } catch {
      ElMessage.error('复制失败')
    }
    document.body.removeChild(textarea)
  }
}

const formatDate = (date: string) => {
  if (!date) return '-'
  return TimeUtil.format(date, TIME_FORMATS.DATE)
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

<style scoped lang="scss">
.subsidy-list-section {
  .batch-actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    margin-bottom: 16px;
    animation: slideDown 0.3s ease-out;
  }

  .batch-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    font-size: 14px;
  }

  .batch-info strong {
    font-size: 16px;
    font-weight: 600;
  }

  .batch-actions-buttons {
    display: flex;
    gap: 8px;
  }

  .loading-state,
  .empty-state {
    padding: 60px 20px;
    text-align: center;
    color: #6c757d;
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e9ecef;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  }

  .empty-state i {
    font-size: 4rem;
    margin-bottom: 20px;
    color: #dee2e6;
  }

  .table-price {
    display: inline-block;
    font-weight: 700;
    letter-spacing: 0.2px;
  }

  .table-price.sale-price {
    color: #dc2626;
  }

  .table-price.subsidy-price {
    color: #16a34a;
  }

  .time-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: none;
  }

  .time-badge.approval-time {
    color: var(--admin-action-manage-color);
    background: var(--admin-action-manage-bg);
    border: 1px solid var(--admin-action-manage-border);
  }

  .time-badge.arrival-time {
    color: var(--admin-action-finance-color);
    background: var(--admin-action-finance-bg);
    border: 1px solid var(--admin-action-finance-border);
  }

  .clickable-text {
    cursor: pointer;
    color: #667eea !important;
    transition: all 0.2s;
    padding: 2px 4px;
    border-radius: 4px;
    display: inline-block;
  }

  .clickable-text:hover {
    background: #e0e7ff !important;
    color: #5a67d8 !important;
  }

  .clickable-text.customer-info-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-weight: 500;
  }

  .clickable-text.customer-info-toggle.has-handler-but-showing-purchaser {
    background: linear-gradient(135deg, #dbeafe, #bfdbfe) !important;
    color: #1e40af !important;
    border: 1px solid #3b82f6;
  }

  .clickable-text.customer-info-toggle.showing-handler {
    background: linear-gradient(135deg, #fef3c7, #fde68a) !important;
    color: #92400e !important;
    border: 1px solid #fbbf24;
  }

  .text-muted {
    color: #adb5bd !important;
  }

  .remarks-tag {
    display: inline-block;
    padding: 2px 10px;
    background-color: #ffc107;
    color: #fff;
    font-size: 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .remarks-tag:hover {
    background-color: #ffca2c;
    transform: scale(1.05);
  }

  .subsidy-photo-cell .photo-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 3px 7px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
  }

  .subsidy-photo-cell .photo-icon-wrapper:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .photo-icon,
  .photo-icon-empty {
    font-size: 12px;
  }

  .photo-icon,
  .photo-icon-empty,
  .upload-hint,
  .photo-count {
    color: #fff;
  }

  .upload-hint {
    font-size: 11px;
  }

  .photo-count {
    min-width: 14px;
    font-size: 10px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.2);
    padding: 1px 4px;
    border-radius: 7px;
    line-height: 1.2;
  }

  .mobile-card-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .mobile-subsidy-card {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at top right, rgba(219, 234, 254, 0.65), transparent 38%),
      linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }

  .mobile-subsidy-card:active {
    transform: scale(0.995);
  }

  .mobile-subsidy-card.selected-row {
    border-color: #60a5fa;
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.16);
  }

  .mobile-subsidy-card.pinned-row {
    border-color: #fbbf24;
    background: linear-gradient(135deg, #fffbeb 0%, #fff 58%);
  }

  .mobile-card-accent {
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: linear-gradient(180deg, #2563eb, #06b6d4);
  }

  .mobile-card-shell {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px;
    padding: 12px 12px 12px 14px;
  }

  .mobile-select-cell {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 2px;
  }

  .mobile-card-content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mobile-card-head,
  .mobile-meta-line,
  .mobile-device-line,
  .mobile-person-line,
  .mobile-card-actions {
    display: flex;
    align-items: center;
  }

  .mobile-card-head,
  .mobile-device-line,
  .mobile-person-line {
    justify-content: space-between;
    gap: 6px;
    min-width: 0;
  }

  .mobile-meta-line {
    flex: 1 1 auto;
    min-width: 0;
    gap: 6px;
  }

  .mobile-date {
    flex-shrink: 0;
    font-size: 12px;
    color: #64748b;
    font-weight: 700;
  }

  .mobile-store {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #0f172a;
    font-size: 13px;
    font-weight: 700;
  }

  .mobile-handler-badge {
    flex-shrink: 0;
    padding: 3px 8px;
    border-radius: 999px;
    background: linear-gradient(135deg, #f97316, #f59e0b);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    line-height: 1.2;
    box-shadow: 0 6px 12px rgba(249, 115, 22, 0.22);
  }

  .mobile-device-line {
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: stretch;
    gap: 6px;
    min-width: 0;
    padding: 2px 0;
  }

  .mobile-person-line {
    justify-content: flex-start;
    flex-wrap: nowrap;
    gap: 10px;
    min-width: 0;
  }

  .mobile-action-mark {
    position: relative;
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 10px;
    color: #fff;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .mobile-action-mark:active {
    transform: scale(0.94);
  }

  .mobile-photo-action {
    background: linear-gradient(135deg, #2563eb, #38bdf8);
    box-shadow: 0 8px 16px rgba(37, 99, 235, 0.22);
  }

  .mobile-photo-action.has-photos {
    background: linear-gradient(135deg, #059669, #34d399);
    box-shadow: 0 8px 16px rgba(5, 150, 105, 0.2);
  }

  .mobile-photo-count {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: #ef4444;
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    line-height: 16px;
    box-shadow: 0 2px 6px rgba(239, 68, 68, 0.32);
  }

  .mobile-brand-text,
  .mobile-model-title,
  .mobile-spec-text {
    max-width: 100%;
    min-height: 26px;
    display: inline-flex;
    align-items: center;
    border: 1px solid transparent;
    border-radius: 999px;
    white-space: nowrap;
  }

  .mobile-brand-text {
    flex: 0 0 auto;
    padding: 0 8px;
    background: linear-gradient(135deg, #eff6ff, #dbeafe);
    border-color: #bfdbfe;
    color: #1d4ed8;
    font-size: 12px;
    font-weight: 800;
    box-shadow: 0 4px 10px rgba(37, 99, 235, 0.08);
  }

  .mobile-model-title {
    flex: 0 0 auto;
    padding: 0 10px;
    background: #ffffff;
    border-color: #cbd5e1;
    color: #0f172a;
    font-size: 14px;
    font-weight: 800;
    line-height: 1.3;
    box-shadow: 0 5px 12px rgba(15, 23, 42, 0.08);
  }

  .mobile-spec-text {
    flex: 0 0 auto;
    padding: 0 8px;
    background: #f8fafc;
    border-color: #e2e8f0;
    color: #475569;
    font-size: 12px;
    font-weight: 700;
  }

  .mobile-price {
    flex-shrink: 0;
    margin-left: auto;
    color: #dc2626;
    font-size: 13px;
    font-weight: 800;
  }

  .mobile-price--subsidy {
    color: #16a34a;
    font-size: 12px;
  }

  .mobile-name,
  .mobile-phone {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #475569;
    font-size: 12px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-name {
    flex: 0 1 auto;
    max-width: 34%;
    min-width: 0;
  }

  .mobile-phone {
    flex: 1 1 auto;
    min-width: 0;
    color: #64748b;
  }

  .mobile-card-actions {
    align-items: center;
    flex-wrap: nowrap;
    gap: 4px;
    margin-top: 2px;
    padding-top: 8px;
    border-top: 1px dashed #e2e8f0;
  }

  .mobile-action-status {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }

  .mobile-action-status.is-pending {
    background: #fef3c7;
    color: #92400e;
  }

  .mobile-action-status.is-approved {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .mobile-action-status.is-arrived {
    background: #dcfce7;
    color: #15803d;
  }

  .mobile-action-status.is-waiting {
    background: #fee2e2;
    color: #b91c1c;
  }

  .qrcode-tooltip {
    position: fixed;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    min-width: 220px;
    animation: fadeIn 0.2s ease-in-out;
    pointer-events: auto;
  }

  .qrcode-meta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    margin-bottom: 12px;
    white-space: nowrap;
  }

  .qrcode-title {
    flex: 0 0 auto;
    font-weight: 600;
    color: #fff;
    font-size: 12px;
    line-height: 22px;
    padding: 0 7px;
    background: #4f46e5;
    border-radius: 4px;
  }

  .qrcode-value {
    flex: 0 0 auto;
    font-size: 12px;
    font-weight: 600;
    line-height: 20px;
    color: #4338ca;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    padding: 0 6px;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    border-radius: 4px;
    white-space: nowrap;
  }

  .qrcode-meta.is-imei .qrcode-title {
    background: #059669;
  }

  .qrcode-meta.is-imei .qrcode-value {
    color: #047857;
    background: #ecfdf5;
    border-color: #a7f3d0;
  }

  .qrcode-tooltip canvas {
    display: block;
    margin: 0 auto;
    border: 1px solid #dee2e6;
    border-radius: 4px;
  }
}

@media (max-width: 768px) {
  .subsidy-list-section {
    .batch-actions-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .batch-actions-buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
