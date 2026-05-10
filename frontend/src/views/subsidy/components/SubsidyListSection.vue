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

      <div class="table-container">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>

        <div v-else-if="subsidyList.length === 0" class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>暂无国补申请记录</p>
        </div>

        <table v-else-if="!isMobile" class="data-table">
          <thead>
            <tr>
              <th class="checkbox-col" style="width: 50px;">
                <el-checkbox
                  :model-value="selectAll"
                  :indeterminate="isIndeterminate"
                  @change="handleSelectAll"
                />
              </th>
              <th
                v-for="column in tableColumns"
                :key="column.key"
                :class="{ 'actions-col': column.key === 'actions' }"
              >
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in displayList"
              :key="item.id"
              v-memo="[item, isSelectedItem(item.id), isPinnedItem(item.id), isShowingHandlerInfo(item)]"
              :class="{ 'selected-row': isSelectedItem(item.id), 'pinned-row': isPinnedItem(item.id) }"
              @dblclick="emit('row-double-click', item)"
            >
              <td class="checkbox-col">
                <el-checkbox
                  :model-value="isSelectedItem(item.id)"
                  @change="(value) => emit('select-item', { id: item.id, checked: !!value })"
                />
              </td>
              <td v-if="fieldVisibility.storeName">{{ item.store_name }}</td>
              <td v-if="fieldVisibility.saleTime">{{ formatDate(item.sale_time) }}</td>
              <td v-if="fieldVisibility.customerName">
                <span
                  class="clickable-text customer-info-toggle"
                  :class="{
                    'has-handler-but-showing-purchaser': hasHandlerInfo(item) && !isShowingHandlerInfo(item),
                    'showing-handler': isShowingHandlerInfo(item)
                  }"
                  :title="hasHandlerInfo(item) ? (isShowingHandlerInfo(item) ? '点击切换到购买者' : '点击切换到办理人') : '点击复制'"
                  @click="hasHandlerInfo(item) ? toggleListItemCustomerInfo(item.id) : copyToClipboard(getDisplayInfo(item, 'name'), '姓名')"
                >
                  {{ getDisplayInfo(item, 'name') }}
                </span>
              </td>
              <td v-if="fieldVisibility.customerPhone">
                <span
                  class="clickable-text"
                  title="点击复制"
                  @click="copyToClipboard(getDisplayInfo(item, 'phone'), '手机号')"
                >
                  {{ getDisplayInfo(item, 'phone') }}
                </span>
              </td>
              <td v-if="fieldVisibility.customerIdcard">
                <span
                  v-if="getDisplayInfo(item, 'idcard') && canViewCustomerIdcard"
                  class="clickable-text"
                  title="点击复制"
                  @click="copyToClipboard(getDisplayInfo(item, 'idcard'), '身份证号')"
                >
                  {{ getDisplayInfo(item, 'idcard') }}
                </span>
                <span v-else class="text-muted">-</span>
              </td>
              <td v-if="fieldVisibility.brand">{{ item.phone_brand }}</td>
              <td v-if="fieldVisibility.model">{{ item.phone_model }}</td>
              <td v-if="fieldVisibility.color">{{ item.phone_color }}</td>
              <td v-if="fieldVisibility.memory">{{ item.phone_memory }}</td>
              <td v-if="fieldVisibility.serialNumber">
                <span
                  class="clickable-text qrcode-trigger"
                  title="点击复制，悬停显示二维码"
                  @click="copyToClipboard(item.serial_number, '序列号')"
                  @mouseenter="showQRCode($event, item.serial_number, '序列号')"
                  @mouseleave="hideQRCode"
                >
                  {{ item.serial_number }}
                </span>
              </td>
              <td v-if="fieldVisibility.imei1">
                <span
                  class="clickable-text qrcode-trigger"
                  title="点击复制，悬停显示二维码"
                  @click="copyToClipboard(item.imei1, 'IMEI1')"
                  @mouseenter="showQRCode($event, item.imei1, 'IMEI1')"
                  @mouseleave="hideQRCode"
                >
                  {{ item.imei1 }}
                </span>
              </td>
              <td v-if="fieldVisibility.imei2">
                <span
                  v-if="item.imei2"
                  class="clickable-text qrcode-trigger"
                  title="点击复制，悬停显示二维码"
                  @click="copyToClipboard(item.imei2, 'IMEI2')"
                  @mouseenter="showQRCode($event, item.imei2, 'IMEI2')"
                  @mouseleave="hideQRCode"
                >
                  {{ item.imei2 }}
                </span>
                <span v-else class="text-muted">-</span>
              </td>
              <td v-if="fieldVisibility.salePrice" class="text-right">
                <span class="table-price sale-price">¥{{ item.sale_price?.toFixed(2) }}</span>
              </td>
              <td v-if="fieldVisibility.subsidyAmount" class="text-right">
                <span class="table-price subsidy-price">¥{{ (item.sale_price - item.subsidy_amount).toFixed(2) }}</span>
              </td>
              <td v-if="fieldVisibility.remarks" class="text-left">
                <span
                  v-if="item.remarks"
                  class="remarks-tag"
                  :title="item.remarks"
                  @click="copyRemarks(item.remarks)"
                >备注</span>
                <span v-else class="text-muted">-</span>
              </td>
              <td class="text-center subsidy-photo-cell">
                <div
                  class="photo-icon-wrapper clickable"
                  :title="item.subsidy_photos && item.subsidy_photos.length > 0 ? '点击查看/管理国补照片' : '点击上传国补照片'"
                  @click.stop="emit('open-photo-manage', item)"
                >
                  <template v-if="item.subsidy_photos && item.subsidy_photos.length > 0">
                    <i class="fas fa-images photo-icon"></i>
                    <span class="photo-count">{{ item.subsidy_photos.length }}</span>
                  </template>
                  <template v-else>
                    <i class="fas fa-image photo-icon-empty"></i>
                    <span class="upload-hint">图片</span>
                  </template>
                </div>
              </td>
              <td v-if="fieldVisibility.applyTime">
                <div
                  v-if="item.apply_time && item.apply_time !== '' && item.apply_time !== null"
                  class="time-badge approval-time"
                >
                  <i class="fas fa-check-circle"></i>
                  {{ formatDate(item.apply_time) }}
                </div>
                <el-button
                  v-else-if="canApprove"
                  type="warning"
                  size="small"
                  @click="emit('audit', item)"
                >
                  <i class="fas fa-clipboard-check"></i>
                  <span>审批</span>
                </el-button>
              </td>
              <td v-if="fieldVisibility.arrivalTime">
                <div
                  v-if="item.arrival_time && item.arrival_time !== '' && item.arrival_time !== null"
                  class="time-badge arrival-time"
                >
                  <i class="fas fa-coins"></i>
                  {{ formatDate(item.arrival_time) }}
                </div>
                <el-button
                  v-else-if="canEdit"
                  type="success"
                  size="small"
                  @click="emit('confirm-arrival', item)"
                >
                  <i class="fas fa-hand-holding-usd"></i>
                  <span>到账</span>
                </el-button>
              </td>
              <td v-if="canShowActions" class="actions-col">
                <div class="action-buttons">
                  <el-button
                    v-if="canEdit"
                    type="primary"
                    size="small"
                    title="编辑"
                    @click="emit('edit', item)"
                  >
                    <i class="fas fa-edit"></i>
                    <span class="btn-text">编辑</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    type="danger"
                    size="small"
                    title="删除"
                    @click="emit('delete', item)"
                  >
                    <i class="fas fa-trash-alt"></i>
                    <span class="btn-text">删除</span>
                  </el-button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else class="mobile-card-list">
          <div
            v-for="item in displayList"
            :key="item.id"
            v-memo="[item, isPinnedItem(item.id), isShowingHandlerInfo(item)]"
            class="mobile-card"
            :class="{ 'pinned-card': isPinnedItem(item.id) }"
            @dblclick="emit('row-double-click', item)"
          >
            <div class="card-section device-section">
              <div class="section-title">
                <i class="fas fa-mobile-alt"></i>
                <span>设备信息</span>
              </div>
              <div class="section-grid compact-grid">
                <div class="grid-item">
                  <span class="item-label">型号</span>
                  <span class="item-value">{{ item.phone_model }}</span>
                </div>
                <div class="grid-item">
                  <span class="item-label">颜色</span>
                  <span class="item-value">{{ item.phone_color }}</span>
                </div>
                <div class="grid-item">
                  <span class="item-label">内存</span>
                  <span class="item-value">{{ item.phone_memory }}</span>
                </div>
                <div v-if="item.serial_number" class="grid-item">
                  <span class="item-label">序列号</span>
                  <span class="item-value clickable-text" @click="copyToClipboard(item.serial_number, '序列号')">
                    {{ item.serial_number }}
                  </span>
                </div>
              </div>
            </div>

            <div class="card-section purchase-section">
              <div class="section-title">
                <i class="fas fa-user"></i>
                <span>购买信息</span>
              </div>
              <div class="customer-info-list">
                <div v-if="getDisplayInfo(item, 'name')" class="info-row-first">
                  <span class="info-label">姓名</span>
                  <span
                    class="info-value customer-info-toggle"
                    :class="{
                      'has-handler-but-showing-purchaser': hasHandlerInfo(item) && !isShowingHandlerInfo(item),
                      'showing-handler': isShowingHandlerInfo(item)
                    }"
                    @click="hasHandlerInfo(item) ? toggleListItemCustomerInfo(item.id) : copyToClipboard(getDisplayInfo(item, 'name'), '姓名')"
                  >
                    {{ getDisplayInfo(item, 'name') }}
                  </span>
                  <span v-if="getDisplayInfo(item, 'phone')" class="info-label phone-label">手机</span>
                  <span
                    v-if="getDisplayInfo(item, 'phone')"
                    class="info-value clickable-text"
                    @click="copyToClipboard(getDisplayInfo(item, 'phone'), '手机号')"
                  >
                    {{ getDisplayInfo(item, 'phone') }}
                  </span>
                </div>
                <div v-if="getDisplayInfo(item, 'idcard') && canViewCustomerIdcard" class="info-row-second">
                  <span class="info-label">身份证</span>
                  <span class="info-value clickable-text" @click="copyToClipboard(getDisplayInfo(item, 'idcard'), '身份证号')">
                    {{ getDisplayInfo(item, 'idcard') }}
                  </span>
                </div>
              </div>
            </div>

            <div class="card-section price-section">
              <div class="section-title">
                <i class="fas fa-tags"></i>
                <span>价格与状态</span>
              </div>
              <div class="section-grid compact-grid">
                <div v-if="item.sale_price" class="grid-item">
                  <span class="item-label">销售价</span>
                  <span class="item-value price-highlight">¥{{ item.sale_price?.toFixed(2) }}</span>
                </div>
                <div v-if="item.subsidy_amount" class="grid-item">
                  <span class="item-label">国补后价</span>
                  <span class="item-value subsidy-amount">¥{{ (item.sale_price - item.subsidy_amount).toFixed(2) }}</span>
                </div>
                <div v-if="item.store_name" class="grid-item">
                  <span class="item-label">店铺</span>
                  <span class="item-value">{{ item.store_name }}</span>
                </div>
                <div v-if="item.sale_time" class="grid-item">
                  <span class="item-label">销售日期</span>
                  <span class="item-value">{{ formatDate(item.sale_time) }}</span>
                </div>
                <div v-if="fieldVisibility.applyTime" class="grid-item">
                  <span class="item-label">国补提交</span>
                  <div class="item-value">
                    <span
                      v-if="item.apply_time && item.apply_time !== '' && item.apply_time !== null"
                      class="time-badge approval-time"
                    >
                      <i class="fas fa-check-circle"></i>
                      {{ formatDate(item.apply_time) }}
                    </span>
                    <el-button
                      v-else-if="canApprove"
                      type="warning"
                      size="small"
                      @click.stop="emit('audit', item)"
                    >
                      <i class="fas fa-clipboard-check"></i>
                      <span>提交审批</span>
                    </el-button>
                  </div>
                </div>
                <div v-if="fieldVisibility.arrivalTime" class="grid-item">
                  <span class="item-label">国补到账</span>
                  <div class="item-value">
                    <span
                      v-if="item.arrival_time && item.arrival_time !== '' && item.arrival_time !== null"
                      class="time-badge arrival-time"
                    >
                      <i class="fas fa-coins"></i>
                      {{ formatDate(item.arrival_time) }}
                    </span>
                    <el-button
                      v-else-if="canEdit"
                      type="success"
                      size="small"
                      @click.stop="emit('confirm-arrival', item)"
                    >
                      <i class="fas fa-hand-holding-usd"></i>
                      <span>确认到账</span>
                    </el-button>
                  </div>
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
          <div class="qrcode-title">{{ qrCodeTitle }}</div>
          <div class="qrcode-value">{{ qrCodeValue }}</div>
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
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'

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

const handleSelectAll = (value: boolean | string | number) => {
  emit('select-all', Boolean(value))
}

const isSelectedItem = (id: number) => selectedItemIdSet.value.has(id)
const isPinnedItem = (id: number) => pinnedItemIdSet.value.has(id)

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
  const tooltipHeight = 300
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
  .table-section {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);

    @media (max-width: 768px) {
      padding: 16px;
    }
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .record-count {
    margin-left: auto;
    font-size: 0.875rem;
    font-weight: 400;
    color: #6c757d;
  }

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

  .data-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: white;
    border-radius: 8px;
    overflow: hidden;
  }

  .data-table thead th {
    background: linear-gradient(135deg, #495057 0%, #343a40 100%);
    color: white;
    padding: 12px 10px;
    text-align: center;
    font-weight: 600;
    font-size: 14px;
    border-right: 1px solid #dee2e6;
    border-bottom: 2px solid #dee2e6;
    white-space: nowrap;
  }

  .data-table tbody tr {
    transition: all 0.2s ease;
    position: relative;
    cursor: pointer;
  }

  .data-table tbody tr:nth-child(even) {
    background: #f8f9fa;
  }

  .data-table tbody tr:hover {
    background: #e3f2fd !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    z-index: 1;
  }

  .data-table tbody td {
    padding: 6px;
    border-right: 1px solid #e9ecef;
    border-bottom: 1px solid #e9ecef;
    font-size: 14px;
    color: #2c3e50;
    font-weight: 500;
    text-align: center;
  }

  .table-price {
    display: inline-block;
    font-weight: 700;
    letter-spacing: 0.2px;
  }

  .table-price.sale-price,
  .mobile-card .item-value.price-highlight {
    color: #dc2626;
  }

  .table-price.subsidy-price,
  .mobile-card .item-value.subsidy-amount {
    color: #16a34a;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .data-table :deep(.el-button--small),
  .batch-actions-buttons :deep(.el-button--small),
  .mobile-card :deep(.el-button--small) {
    height: 28px !important;
    min-height: 28px !important;
    padding: 0 10px !important;
    font-size: 12px !important;
    line-height: 1 !important;
    border-radius: 4px !important;
    white-space: nowrap;

    i {
      font-size: 12px !important;
      line-height: 1 !important;
    }

    span {
      display: inline-flex;
      align-items: center;
      line-height: 1 !important;
      white-space: nowrap;
    }
  }

  .time-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }

  .time-badge.approval-time {
    background: linear-gradient(135deg, #28a745, #20c997);
    color: white;
  }

  .time-badge.arrival-time {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
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
    gap: 4px;
    padding: 6px 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
  }

  .subsidy-photo-cell .photo-icon-wrapper:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .photo-icon,
  .photo-icon-empty,
  .upload-hint,
  .photo-count {
    color: #fff;
  }

  .photo-count {
    font-size: 12px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 6px;
    border-radius: 10px;
  }

  .mobile-card-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 4px;
  }

  .mobile-card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.06);
  }

  .mobile-card .card-section {
    padding: 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .mobile-card .card-section:last-child {
    border-bottom: none;
  }

  .mobile-card .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 700;
    color: #1a1a1a;
  }

  .mobile-card .section-title i {
    font-size: 14px;
    color: #667eea;
  }

  .mobile-card .section-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px 8px;
  }

  .mobile-card .grid-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .mobile-card .item-label {
    font-size: 10px;
    color: #8e8e93;
    font-weight: 600;
    text-transform: uppercase;
  }

  .mobile-card .item-value {
    font-size: 13px;
    color: #1c1c1e;
    font-weight: 600;
    line-height: 1.3;
    word-break: break-all;
  }

  .mobile-card .customer-info-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .mobile-card .info-row-first,
  .mobile-card .info-row-second {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mobile-card .info-label {
    color: #8e8e93;
    font-weight: 600;
    font-size: 10px;
    flex-shrink: 0;
  }

  .mobile-card .phone-label {
    margin-left: 4px;
  }

  .mobile-card .device-section {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%);
  }

  .mobile-card .purchase-section {
    background: linear-gradient(135deg, rgba(52, 199, 89, 0.03) 0%, rgba(48, 209, 88, 0.03) 100%);
  }

  .mobile-card .price-section {
    background: linear-gradient(135deg, rgba(255, 149, 0, 0.03) 0%, rgba(255, 59, 48, 0.03) 100%);
  }

  @media (max-width: 768px) {
    .data-table :deep(.el-button--small),
    .batch-actions-buttons :deep(.el-button--small),
    .mobile-card :deep(.el-button--small) {
      height: 32px !important;
      min-height: 32px !important;
      padding: 0 12px !important;
      font-size: 12px !important;
    }
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

  .qrcode-title {
    font-weight: 600;
    color: #495057;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .qrcode-value {
    font-size: 12px;
    color: #6c757d;
    margin-bottom: 12px;
    word-break: break-all;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 4px;
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
