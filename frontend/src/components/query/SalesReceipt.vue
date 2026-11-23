<template>
  <MobileDialog
    :model-value="visible"
    :title="modalTitle"
    width="fit-content"
    max-width="960px"
    dialog-class="sales-receipt-dialog tf-dialog-body-flush"
    :show-default-footer="false"
    @update:model-value="handleDialogVisibility"
    @close="handleClose"
  >
    <div class="receipt-dialog-shell">
      <div class="add-item-section">
        <div class="add-item-controls">
          <el-input
            v-model="searchKeyword"
            placeholder="输入IMEI或序列号搜索添加..."
            class="search-input"
            :disabled="isDownloading"
            clearable
            @keyup.enter="handleSearchAndAdd"
            @clear="handleSearchClear"
          />
          <el-button
            class="search-add-button"
            :loading="isSearching"
            :disabled="isDownloading"
            @click="handleSearchAndAdd"
          >
            <i class="fas fa-search" />
            搜索添加
          </el-button>
        </div>

        <div
          v-if="searchResults.length > 0"
          class="search-results"
        >
          <div class="results-header">
            找到 {{ searchResults.length }} 个结果，点击添加
          </div>
          <div
            v-for="(result, index) in searchResults"
            :key="index"
            class="result-item"
            @click="addSearchResult(result)"
          >
            <span class="item-info">{{ result.brand_name }} {{ result.model_name }} - {{ result.color_name }} {{ result.memory_size }}</span>
            <span class="item-imei">IMEI: {{ result.imei }}</span>
            <span class="item-price">¥{{ formatPrice(Number(result.sale_price) || 0) }}</span>
          </div>
        </div>

        <div
          v-if="searchError"
          class="search-error"
        >
          {{ searchError }}
        </div>
      </div>

      <div
        v-tf-loading="{ active: accessoryLoading, text: '正在核对随单配件...' }"
        class="receipt-scroll-area"
      >
        <div
          ref="receiptRef"
          class="sales-receipt"
          data-receipt-export="true"
          :class="receiptClass"
        >
          <header class="receipt-header">
            <h1 class="receipt-title">
              {{ receiptTitle }}
            </h1>
            <div class="receipt-meta">
              <div class="receipt-meta-item">
                <span>凭证号码</span>
                <strong class="receipt-number-value">{{ receiptNumber }}</strong>
              </div>
              <div class="receipt-meta-item">
                <span>销售时间</span>
                <strong class="receipt-date-value">{{ receiptDate }}</strong>
              </div>
            </div>
          </header>

          <section
            class="party-panel"
            :class="{ 'party-panel--supplier': props.status === 'supplier_proxy' }"
          >
            <div class="party-column">
              <div
                v-if="hasCustomerInfo"
                class="party-item"
              >
                <div class="party-field">
                  <span class="party-label">{{ customerRoleLabel }}</span>
                  <strong class="party-value party-value--customer">{{ customerName }}</strong>
                </div>
              </div>
              <div
                v-if="hasCustomerInfo && customerPhone"
                class="party-item"
              >
                <div class="party-field">
                  <span class="party-label">联系电话</span>
                  <strong class="party-value party-value--phone">{{ customerPhone }}</strong>
                </div>
              </div>
              <div
                v-if="showSupplierInfo"
                class="party-item"
              >
                <div class="party-field">
                  <span class="party-label">供应商</span>
                  <strong class="party-value party-value--supplier">{{ supplierName }}</strong>
                </div>
              </div>
              <div
                v-if="showSupplierReceiverInfo"
                class="party-item"
              >
                <div class="party-field">
                  <span class="party-label">客户姓名</span>
                  <strong class="party-value party-value--customer">{{ customerName }}</strong>
                </div>
              </div>
              <div
                v-if="showSupplierReceiverInfo && customerPhone"
                class="party-item"
              >
                <div class="party-field">
                  <span class="party-label">联系电话</span>
                  <strong class="party-value party-value--phone">{{ customerPhone }}</strong>
                </div>
              </div>
            </div>
            <div class="party-column">
              <div class="party-field">
                <span class="party-label">销售门店</span>
                <strong class="party-value party-value--store">{{ storeName || '-' }}</strong>
              </div>
              <div
                v-if="props.status !== 'supplier_proxy'"
                class="party-field"
              >
                <span class="party-label">单据状态</span>
                <strong class="party-value party-value--status">{{ receiptStatusText }}</strong>
              </div>
            </div>
          </section>

          <el-alert
            v-if="accessoryError"
            :title="accessoryError"
            type="error"
            :closable="false"
          />
          <el-alert
            v-else-if="!canViewAccessories && status === 'sold'"
            title="未获配件查看权限，本凭证仅含手机。"
            type="warning"
            :closable="false"
          />

          <div class="items-list">
            <el-table
              :data="receiptRows"
              class="data-table compact-fit-table receipt-table receipt-unified-table"
              :style="receiptTableStyle"
              border
              :fit="true"
              table-layout="fixed"
              row-key="key"
              :row-class-name="receiptRowClass"
              :span-method="receiptSpanMethod"
            >
              <el-table-column
                label="序号"
                :width="$getNumberColumnWidth(receiptRows.filter(row => row.kind !== 'accessory-section').map((_row, index) => index + 1), 68)"
                align="center"
              >
                <template #default="{ row }">
                  <span
                    v-if="row.kind === 'accessory-section'"
                    class="receipt-section-label"
                  >配件 / 赠品明细</span>
                  <span
                    v-else
                    class="table-number-badge"
                  >{{ row.index + 1 }}</span>
                </template>
              </el-table-column>
              <el-table-column
                label="商品 / 配件名称"
                min-width="205"
                class-name="complete-text-column"
              >
                <template #default="{ row }">
                  <template v-if="row.kind === 'phone'">
                    <strong class="receipt-product-name">{{ row.item.brand }} {{ row.item.model }}</strong>
                  </template>
                  <div
                    v-else-if="row.kind === 'accessory'"
                    class="accessory-product-cell"
                  >
                    <div class="accessory-product-heading">
                      <strong
                        v-if="canViewAccessoryField('name')"
                        class="receipt-product-name"
                      >{{ row.accessory.goods.name || '-' }}</strong>
                      <span
                        v-if="canViewAccessoryField('usage_type')"
                        :class="['status-badge', row.accessory.goods.sale_type === 'gift' ? 'status-warning' : 'status-success']"
                      >{{ row.accessory.goods.sale_type === 'gift' ? '赠送' : row.accessory.goods.sale_type === 'sale' ? '购买' : '-' }}</span>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                label="规格 / 成色"
                :min-width="receiptSpecColumnWidth"
                align="center"
                class-name="complete-text-column"
              >
                <template #default="{ row }">
                  <template v-if="row.kind === 'phone'">
                    <div class="receipt-phone-spec">
                      <span>{{ row.item.color || '-' }}</span>
                      <span
                        class="receipt-phone-spec__separator"
                        aria-hidden="true"
                      >/</span>
                      <span>{{ row.item.memory || '-' }}</span>
                      <span
                        class="receipt-phone-spec__separator"
                        aria-hidden="true"
                      >/</span>
                      <span :class="['condition-badge', row.item.isNew === 1 ? 'condition-new' : 'condition-used']">
                        {{ row.item.isNew === 1 ? '全新' : '二手' }}
                      </span>
                    </div>
                  </template>
                  <span
                    v-else-if="row.kind === 'accessory'"
                    class="accessory-product-meta"
                  >
                    {{ [canViewAccessoryField('brand_name') ? row.accessory.goods.brand_name : '', canViewAccessoryField('product_model') ? row.accessory.goods.product_model : '', canViewAccessoryField('color_name') ? row.accessory.goods.color_name : ''].filter(Boolean).join(' / ') || '-' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column
                label="设备 / SN信息"
                min-width="210"
                class-name="wrapped-text-column"
              >
                <template #default="{ row }">
                  <template v-if="row.kind === 'phone'">
                    <div class="cell-stack">
                      <span v-if="row.item.imei">IMEI：{{ row.item.imei }}</span>
                      <span v-else>SN：{{ row.item.serialNumber || '-' }}</span>
                    </div>
                  </template>
                  <div
                    v-else-if="row.kind === 'accessory'"
                    class="accessory-linked-cell"
                  >
                    <span class="accessory-linked-phone">关联： {{ row.accessory.phone.imei || row.accessory.phone.serialNumber || '-' }}</span>
                    <span
                      v-if="canViewAccessoryField('serial_number') && row.accessory.goods.serial_numbers?.length"
                      class="accessory-linked-sn"
                    >配件SN：{{ row.accessory.goods.serial_numbers.join('、') }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                label="数量"
                width="72"
                align="center"
              >
                <template #default="{ row }">
                  <template v-if="row.kind === 'phone'">
                    1
                  </template>
                  <template v-else-if="row.kind === 'accessory'">
                    {{ canViewAccessoryField('total_quantity') ? row.accessory.goods.quantity ?? '-' : '-' }}{{ canViewAccessoryField('unit') ? row.accessory.goods.unit : '' }}
                  </template>
                </template>
              </el-table-column>
              <el-table-column
                label="金额"
                :min-width="receiptAmountColumnWidth"
                align="center"
              >
                <template #default="{ row }">
                  <template v-if="row.kind === 'phone'">
                    <strong class="receipt-product-amount">{{ `¥${formatPrice(row.item.salePrice)}` }}</strong>
                  </template>
                  <div
                    v-else-if="row.kind === 'accessory'"
                    :class="['accessory-amount-cell', { 'is-gift': row.accessory.goods.sale_type === 'gift' }]"
                  >
                    <strong
                      v-if="canViewAccessoryField('total_price')"
                      class="receipt-product-amount accessory-actual-amount"
                    >实收 {{ receiptMoney(row.accessory.goods.total_price) }}</strong>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div class="totals-bar">
            <div class="total-count">
              <span>总数量</span>
              <strong>{{ items.length }}台<span v-if="accessoryRows.length"> / {{ accessoryQuantity }}件配件</span></strong>
            </div>
            <div class="total-amount-words">
              <span>人民币（大写）：</span>
              <strong>{{ canTotal ? totalAmountInWords : '金额未完整展示' }}</strong>
            </div>
            <div class="total-amount">
              <span>（小写）</span>
              <strong>{{ canTotal ? `¥ ${formatTotalAmount(totalAmount)}` : '-' }}</strong>
            </div>
          </div>

          <section class="after-sale-notes">
            <strong>{{ receiptNotesTitle }}</strong>
            <p
              v-for="(note, index) in receiptNotes"
              :key="index"
            >
              {{ index + 1 }}. {{ note }}
            </p>
          </section>

          <footer class="receipt-signature">
            <div class="receipt-signature-meta">
              <div class="receipt-signature-item">
                <strong>销售员：</strong>
                <span>{{ salesOperator || '-' }}</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="tf-dialog-actions">
        <el-button
          v-if="accessoryError"
          type="warning"
          :loading="accessoryLoading"
          @click="loadAccessories"
        >
          重新核对
        </el-button>
        <el-button
          type="primary"
          :loading="isDownloading"
          :disabled="!canExport"
          @click="downloadImage"
        >
          <i class="fas fa-download" />
          {{ isDownloading ? '正在生成图片' : '保存图片' }}
        </el-button>
        <el-button
          type="default"
          :disabled="!canExport || isDownloading"
          @click="handlePrint"
        >
          <i class="fas fa-print" />
          打印
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { printElement } from '@/utils/print'
import { computed, nextTick, ref, watch, type CSSProperties } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import type { CloseEmits, VisibleProps } from '@/types/component'
import { logger } from '@/utils/logger'
import { loadHtml2Canvas, normalizeCanvasColors } from '@/utils/html2canvas'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { formatRmbUppercase, formatAmount } from '@/utils/format'
import { getPhoneReceiptAccessories } from '@/api/sales-receipt'
import { isGiftReturnAgreement } from '@/utils/query-goods'
import type { ReceiptItem, SearchPhoneResult, PhoneReceiptAccessory } from '@/types/sales-receipt'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { canViewQueryGoodsField as canViewAccessoryField } from '@/components/accessory-field-permissions'
import { getTextColumnMinWidth } from '@/utils/table-layout'


interface Props extends VisibleProps {
  items?: ReceiptItem[]
  status?: string
  customerName?: string
  customerPhone?: string
  supplierName?: string
  storeName?: string
  salesOperator?: string
  receiptNumber?: string
  saleDate?: string
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  items: () => [],
  status: 'sold',
  customerName: '',
  customerPhone: '',
  supplierName: '',
  storeName: '',
  salesOperator: '',
  receiptNumber: '',
  saleDate: ''
})
const siteSettingsStore = useSiteSettingsStore()

interface Emits extends CloseEmits {
  addItem: [item: SearchPhoneResult]
}

const emit = defineEmits<Emits>()

const receiptRef = ref<HTMLElement>()
const receiptTableStyle = computed<CSSProperties | undefined>(() => props.status === 'sold'
  ? { '--admin-data-table-cell-color': 'var(--tf-color-gray-bootstrap-700)' } as CSSProperties
  : undefined)
const isDownloading = ref(false)
const searchKeyword = ref('')
const searchResults = ref<SearchPhoneResult[]>([])
const searchError = ref('')
const isSearching = ref(false)

const buildReceiptTitle = (suffix: string) => {
  const siteName = siteSettingsStore.settings.siteName?.trim()
  return siteName ? `${siteName}${suffix}` : suffix
}

const receiptConfig = computed(() => {
  switch (props.status) {
  case 'peer_transfer':
    return { title: buildReceiptTitle('批发凭证'), class: 'transfer-receipt receipt-theme--transfer' }
  case 'supplier_proxy':
    return { title: buildReceiptTitle('划拨凭证'), class: 'supplier-receipt receipt-theme--supplier' }
  default:
    return { title: buildReceiptTitle('销售凭证'), class: 'sales-receipt-theme receipt-theme--sales' }
  }
})

const receiptTitle = computed(() => receiptConfig.value.title)
const receiptClass = computed(() => receiptConfig.value.class)
const receiptNotes = computed(() => {
  if (props.status === 'supplier_proxy') {
    return [
      '本单据为划拨凭证，请妥善保管，作为划拨依据。',
      '本商品应上级供应商要求，对该商品进行划拨操作至您接受。',
      '收到相关商品请第一时间确认完整，如发现商品异常请及时联系我们。'
    ]
  }
  if (props.status === 'peer_transfer') {
    return [
      '同行调货请遵守非跨域激活，提供本市区内有效激活水印照片。',
      '收到商品第一时间检查外观，现在拆封后发现机器异常提供开箱视频。',
      '同行调货自行开票售后，在规定时间（拿货当天）回款。'
    ]
  }
  return [
    '本单据为销售凭证，请妥善保管，作为售后保修依据。',
    '全新手机非人为保修一年，进水，摔坏，变形等人为不予保修（售后检测为准）。',
    '二手手机非质量问题售出不退不换；保修1月凭此单据享受店内保修服务。',
    '请当面核对商品外观、IMEI码及序列号，离柜后外观问题概不负责。'
  ]
})
const receiptNotesTitle = '【售后说明】'
const receiptStatusText = computed(() => props.status === 'supplier_proxy' ? '已完成划拨' : '已完成')
const modalTitle = computed(() => receiptConfig.value.title)
const receiptNumber = computed(() => props.receiptNumber || '待生成')
const receiptDate = computed(() => props.saleDate
  ? TimeUtil.format(props.saleDate, TIME_FORMATS.DISPLAY_DATE)
  : TimeUtil.nowFormatted(TIME_FORMATS.DISPLAY_DATE))

const hasCustomerInfo = computed(() => Boolean((props.status === 'sold' || props.status === 'peer_transfer') && props.customerName))
const customerRoleLabel = '客户姓名'
const showSupplierInfo = computed(() => Boolean(props.status === 'supplier_proxy' && props.supplierName))
const showSupplierReceiverInfo = computed(() => Boolean(props.status === 'supplier_proxy' && props.customerName))

const queryPermissions = usePagePermissions('query')
const canViewAccessories = computed(() => queryPermissions.canView.value && queryPermissions.hasPermission('goods-view'))
const { nextRequest, cancelLatest, isCanceledError } = useLatestRequest()
const accessoryLoading = ref(false)
const accessoryError = ref('')
type AccessoryReceiptRow = { phone: ReceiptItem; goods: PhoneReceiptAccessory }
type ReceiptTableRow =
  | { kind: 'phone'; key: string; item: ReceiptItem; index: number }
  | { kind: 'accessory-section'; key: string }
  | { kind: 'accessory'; key: string; accessory: AccessoryReceiptRow; index: number }

const accessoryRows = ref<AccessoryReceiptRow[]>([])
const receiptRows = computed<ReceiptTableRow[]>(() => {
  const phoneRows: ReceiptTableRow[] = props.items.map((item, index) => ({
    kind: 'phone',
    key: `phone-${item.sale_id ?? item.phone_id}-${index}`,
    item,
    index
  }))
  if (!accessoryRows.value.length) return phoneRows
  return [
    ...phoneRows,
    { kind: 'accessory-section', key: 'accessory-section' },
    ...accessoryRows.value.map((accessory, index) => ({
      kind: 'accessory' as const,
      key: `accessory-${accessory.phone.sale_id ?? accessory.phone.phone_id}-${accessory.goods.id}-${index}`,
      accessory,
      index
    }))
  ]
})
const receiptSpecColumnWidth = computed(() => getTextColumnMinWidth([
  '规格 / 成色',
  ...props.items.map(item => `${item.color || '-'}/${item.memory || '-'}/${item.isNew === 1 ? '全新' : '二手'}`),
  ...accessoryRows.value.map(row => [
    canViewAccessoryField('brand_name') ? row.goods.brand_name : '',
    canViewAccessoryField('product_model') ? row.goods.product_model : '',
    canViewAccessoryField('color_name') ? row.goods.color_name : ''
  ].filter(Boolean).join('/') || '-')
], {
  minWidth: 176,
  maxWidth: 190,
  horizontalPadding: 20,
  asciiCharacterWidth: 7,
  wideCharacterWidth: 12
}))
const receiptAmountColumnWidth = computed(() => getTextColumnMinWidth([
  '金额',
  ...props.items.map(item => `¥${formatPrice(item.salePrice)}`),
  ...(canViewAccessoryField('total_price')
    ? accessoryRows.value.map(row => `实收 ¥${formatAmount(row.goods.total_price ?? 0)}`)
    : [])
], {
  minWidth: 112,
  maxWidth: 136,
  horizontalPadding: 16,
  asciiCharacterWidth: 7,
  wideCharacterWidth: 12
}))
const loadAccessories = async () => {
  cancelLatest()
  accessoryRows.value = []
  accessoryError.value = ''
  accessoryLoading.value = false
  if (!props.visible || props.status !== 'sold' || !canViewAccessories.value) return
  if (props.items.some(item => !Number.isSafeInteger(item.sale_id) || Number(item.sale_id) <= 0)) {
    accessoryError.value = '缺少原手机销售记录，无法核对随单配件，请从综合查询销售记录重新打开凭证。'
    return
  }
  const request = nextRequest()
  accessoryLoading.value = true
  try {
    const phones = [...new Map(props.items.map(phone => [phone.sale_id, phone])).values()]
    const results = await Promise.all(phones.map(async phone => {
      const response = await getPhoneReceiptAccessories(Number(phone.sale_id), request.signal)
      if (!response.success || !Array.isArray(response.data) || !response.data.every(isGiftReturnAgreement)) throw new Error('配件明细响应不完整')
      return response.data.map(goods => ({ phone, goods }))
    }))
    if (request.isLatest()) accessoryRows.value = results.flat()
  } catch (error) {
    if (request.isLatest() && !isCanceledError(error)) {
      accessoryError.value = '随单配件核对失败，请重试后再打印或保存。'
      logger.error('核对销售凭证配件失败:', error)
    }
  } finally {
    if (request.isLatest()) accessoryLoading.value = false
  }
}
watch(() => [props.visible, props.status, props.items.map(item => `${item.phone_id}:${item.sale_id}`).join(','), canViewAccessories.value], () => { void loadAccessories() }, { immediate: true })

const accessoryQuantity = computed(() => canViewAccessoryField('total_quantity') && accessoryRows.value.every(row => row.goods.quantity !== null)
  ? accessoryRows.value.reduce((sum, row) => sum + Number(row.goods.quantity), 0) : '-')
const receiptRowClass = ({ row }: { row?: ReceiptTableRow }) => {
  if (!row) return ''
  if (row.kind === 'accessory-section') return 'receipt-row--accessory-section'
  if (row.kind === 'accessory') return row.accessory.goods.sale_type === 'gift' ? 'accessory-row--gift' : 'accessory-row--sale'
  return 'receipt-row--phone'
}
const receiptSpanMethod = ({ row, columnIndex }: { row: ReceiptTableRow; columnIndex: number }) => {
  if (row.kind !== 'accessory-section') return undefined
  return columnIndex === 0 ? [1, 6] : [0, 0]
}
const canExport = computed(() => !accessoryLoading.value && !accessoryError.value)
const canTotal = computed(() => canExport.value && accessoryRows.value.every(row => row.goods.total_price !== null) &&
  (!accessoryRows.value.length || canViewAccessoryField('total_price') && canViewAccessoryField('unit_price') && canViewAccessoryField('total_quantity') && canViewAccessoryField('usage_type')))
const receiptMoney = (amount: string | number | null | undefined) => amount === null || amount === undefined ? '-' : `¥${formatAmount(amount)}`
// 金额按分相加；配件使用成交净额，赠品为零，不按参考价或积分抵扣前金额计入。
const totalAmount = computed(() => (props.items.reduce((sum, item) => sum + Math.round(Number(item.salePrice || 0) * 100), 0) +
  accessoryRows.value.reduce((sum, row) => sum + Math.round(Number(row.goods.total_price || 0) * 100), 0)) / 100)
const totalAmountInWords = computed(() => formatRmbUppercase(totalAmount.value))
const formatPrice = (price: number) => {
  const numValue = Number(price || 0)
  return formatAmount(numValue)
}

const formatTotalAmount = (amount: number) => formatPrice(amount)

const handleClose = () => {
  emit('close')
}

const handleDialogVisibility = (nextVisible: boolean) => {
  if (!nextVisible) {
    handleClose()
  }
}

const handlePrint = () => {
  if (!receiptRef.value || !canExport.value || isDownloading.value) return

  const printOverrides = `
    @page { size: A4; margin: 12mm; }
    html, body { margin: 0; padding: 0; background: var(--color-bg-white); }
    .sales-receipt { width: 100%; }
    .sales-receipt .items-list { overflow: visible; }
    .sales-receipt .receipt-table { width: 100%; min-width: 0; }
    .sales-receipt .el-table__header, .sales-receipt .el-table__body { width: 100% !important; table-layout: fixed; }
    .sales-receipt col { width: auto; }
    .sales-receipt .el-scrollbar__wrap, .sales-receipt .el-scrollbar__view,
    .sales-receipt .el-table__body-wrapper, .sales-receipt .el-table__inner-wrapper {
      overflow: visible !important; height: auto !important; max-height: none !important;
    }
    .sales-receipt .receipt-table .cell { white-space: normal; overflow-wrap: anywhere; }
    .sales-receipt .el-scrollbar__bar { display: none; }
    .sales-receipt, .sales-receipt * { box-shadow: none; }
    .sales-receipt .receipt-table .el-table__row { break-inside: avoid; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  `
  printElement(receiptRef.value, receiptTitle.value, printOverrides)
}

const downloadImage = async () => {
  if (!canExport.value) return
  if (!receiptRef.value || isDownloading.value) return

  try {
    isDownloading.value = true
    await nextTick()
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    const receiptElement = receiptRef.value
    if (!receiptElement) return

    const html2canvas = await loadHtml2Canvas()
    if (!canExport.value) return
    const exportWidth = Math.ceil(Math.max(receiptElement.getBoundingClientRect().width,
      ...Array.from(receiptElement.querySelectorAll<HTMLElement>('.items-list')).map(list => {
        const style = window.getComputedStyle(list)
        return Math.max(0, ...Array.from(list.querySelectorAll<HTMLElement>('table')).map(table => table.scrollWidth)) +
          (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0)
      })))
    const canvas = await html2canvas(receiptElement, {
      scale: 2,
      width: exportWidth,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: clonedDocument => {
        const receipt = clonedDocument.querySelector<HTMLElement>('[data-receipt-export="true"]')
        if (!receipt) return
        receipt.classList.add('receipt-export-mode')
        receipt.style.width = `${exportWidth}px`
        // 导出时展开 Element 表格的横向滚动容器，手机上未滚到的列也必须完整保存。
        receipt.querySelectorAll<HTMLElement>('.el-scrollbar__wrap, .el-scrollbar__view, .el-table__body-wrapper, .el-table__inner-wrapper').forEach(element => {
          element.style.overflow = 'visible'
          element.style.height = 'auto'
          element.style.maxHeight = 'none'
        })
        normalizeCanvasColors(receipt)
      }
    })
    const imageBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('图片转换失败'))
      }, 'image/png')
    })
    canvas.width = 1
    canvas.height = 1
    const downloadUrl = window.URL.createObjectURL(imageBlob)
    const exportTitle = receiptTitle.value
    const exportNumber = receiptNumber.value
    const link = document.createElement('a')
    link.download = `${exportTitle}_${exportNumber}.png`
    link.href = downloadUrl
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    window.setTimeout(() => {
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    }, 1000)
  } catch (error) {
    logger.error('生成图片失败:', error)
  } finally {
    isDownloading.value = false
  }
}

const handleSearchAndAdd = async () => {
  if (isDownloading.value || isSearching.value) return
  if (!searchKeyword.value.trim()) {
    searchError.value = '请输入IMEI或序列号'
    return
  }

  isSearching.value = true
  searchError.value = ''
  searchResults.value = []

  try {
    const unifiedApi = (await import('@/utils/unified-api')).unifiedApi
    const response = await unifiedApi.get(
      `/phones/search-by-identifier?keyword=${encodeURIComponent(searchKeyword.value.trim())}`,
      { showError: false }
    )

    if (response.success) {
      if (Array.isArray(response.data)) {
        if (response.data.length === 0) {
          searchError.value = response.message || '未找到匹配的商品'
        } else {
          searchResults.value = response.data
        }
      } else if (response.data) {
        searchResults.value = [response.data]
      }
    } else {
      searchError.value = response.message || '未找到商品'
    }
  } catch (error) {
    logger.error('搜索失败:', error)
    searchError.value = '搜索失败，请重试'
  } finally {
    isSearching.value = false
  }
}

const addSearchResult = (result: SearchPhoneResult) => {
  if (!result || isDownloading.value) return

  emit('addItem', result)
  searchKeyword.value = ''
  searchResults.value = []
  searchError.value = ''
}

const handleSearchClear = () => {
  searchResults.value = []
  searchError.value = ''
}
</script>

<style scoped lang="scss" src="./styles/sales-receipt/layout.scss"></style>
<style scoped lang="scss" src="./styles/sales-receipt/theme.scss"></style>

<style scoped lang="scss" src="./styles/sales-receipt/content.scss"></style>
<style scoped lang="scss" src="./styles/sales-receipt/responsive.scss"></style>
