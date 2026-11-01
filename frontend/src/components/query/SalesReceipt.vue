<template>
  <MobileDialog
    :model-value="visible"
    :title="modalTitle"
    width="fit-content"
    max-width="960px"
    dialog-class="sales-receipt-dialog"
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
            clearable
            @keyup.enter="handleSearchAndAdd"
            @clear="handleSearchClear"
          />
          <el-button
            class="search-add-button"
            :loading="isSearching"
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

      <div class="receipt-scroll-area">
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

          <div class="items-list">
            <el-table
              :data="items"
              class="data-table compact-fit-table receipt-table"
              :style="receiptTableStyle"
              border
              :fit="true"
              table-layout="fixed"
            >
              <el-table-column
                label="序号"
                width="68"
                align="center"
              >
                <template #default="{ $index }">
                  {{ $index + 1 }}
                </template>
              </el-table-column>
              <el-table-column
                label="商品名称"
                min-width="150"
                align="center"
                class-name="complete-text-column"
              >
                <template #default="{ row }">
                  <strong class="receipt-product-name">{{ row.brand }} {{ row.model }}</strong>
                </template>
              </el-table-column>
              <el-table-column
                label="规格/成色"
                min-width="145"
                align="center"
                class-name="complete-text-column"
              >
                <template #default="{ row }">
                  {{ row.color }} / {{ row.memory }} / {{ row.isNew === 1 ? '全新' : '二手' }}
                </template>
              </el-table-column>
              <el-table-column
                label="设备信息（IMEI / SN）"
                min-width="220"
                align="center"
                class-name="wrapped-text-column"
              >
                <template #default="{ row }">
                  <div class="cell-stack">
                    <span v-if="row.imei">IMEI：{{ row.imei }}</span>
                    <span v-else>SN：{{ row.serialNumber || '-' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                label="数量"
                width="72"
                align="center"
              >
                <template #default>1</template>
              </el-table-column>
              <el-table-column
                label="金额"
                width="112"
                align="center"
              >
                <template #default="{ row }">
                  <strong class="receipt-product-amount">{{ `¥${formatPrice(row.salePrice)}` }}</strong>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div class="totals-bar">
            <div class="total-count">
              <span>总数量</span>
              <strong>{{ items.length }} 台</strong>
            </div>
            <div class="total-amount-words">
              <span>人民币（大写）：</span>
              <strong>{{ totalAmountInWords }}</strong>
            </div>
            <div class="total-amount">
              <span>（小写）</span>
              <strong>¥ {{ formatTotalAmount(totalAmount) }}</strong>
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
          type="primary"
          :loading="isDownloading"
          @click="downloadImage"
        >
          <i class="fas fa-download" />
          {{ isDownloading ? '正在生成图片' : '保存图片' }}
        </el-button>
        <el-button
          type="default"
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
import { computed, nextTick, ref, type CSSProperties } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import type { CloseEmits, VisibleProps } from '@/types/component'
import { logger } from '@/utils/logger'
import { loadHtml2Canvas } from '@/utils/html2canvas'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { formatRmbUppercase } from '@/utils/format'

interface ReceiptItem {
  phone_id: number
  brand: string
  model: string
  color: string
  memory: string
  imei: string
  serialNumber: string
  salePrice: number
  isNew: number
}

interface SearchPhoneResult {
  id: number
  brand_name?: string
  model_name?: string
  color_name?: string
  memory_size?: string
  imei?: string
  sale_price?: number | string
}

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
    '全新商品非人为保修一年，进水，摔坏，变形等人为不予保修（售后检测为准）。',
    '二手商品非质量问题售出不退不换；保修1月凭此单据享受店内保修服务。',
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

const totalAmount = computed(() => props.items.reduce((sum, item) => sum + (Number(item.salePrice) || 0), 0))
const totalAmountInWords = computed(() => formatRmbUppercase(totalAmount.value))
const formatPrice = (price: number) => {
  const numValue = Number(price || 0)
  return numValue.toLocaleString('zh-CN', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

const formatTotalAmount = (amount: number) => formatPrice(amount)

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[character] || character))

const handleClose = () => {
  emit('close')
}

const handleDialogVisibility = (nextVisible: boolean) => {
  if (!nextVisible) {
    handleClose()
  }
}

const handlePrint = () => {
  if (!receiptRef.value) return

  const printContent = receiptRef.value.innerHTML
  const stylesheetText = Array.from(document.styleSheets).map((styleSheet) => {
    try {
      return Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('\n')
    } catch {
      return ''
    }
  }).join('\n')
  const printWindow = window.open('', '', 'width=800,height=600')
  if (!printWindow) return

  const printOverrides = `
    @page { size: A4; margin: 12mm; }
    html, body { margin: 0; padding: 0; background: var(--color-bg-white); }
    .sales-receipt { width: 100%; }
    .sales-receipt .items-list { overflow: visible; }
    .sales-receipt .receipt-table { width: 100%; min-width: 0; }
    .sales-receipt, .sales-receipt * { box-shadow: none; }
    .sales-receipt, .sales-receipt .receipt-table .el-table__row { break-inside: avoid; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  `
  const printDocument = printWindow.document
  printDocument.open()
  printDocument.write(`<!DOCTYPE html><html><head><title>${escapeHtml(receiptTitle.value)}</title></head><body>${printContent}</body></html>`)
  const printStyle = printDocument.createElement('style')
  printStyle.textContent = `${stylesheetText}\n${printOverrides}`
  printDocument.head.append(printStyle)
  printDocument.close()
  void printDocument.fonts.ready.then(() => printWindow.print(), () => printWindow.print())
}

const downloadImage = async () => {
  if (!receiptRef.value || isDownloading.value) return

  try {
    isDownloading.value = true
    await nextTick()
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    const receiptElement = receiptRef.value
    if (!receiptElement) return

    const html2canvas = await loadHtml2Canvas()
    const canvas = await html2canvas(receiptElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: clonedDocument => {
        clonedDocument.querySelector('[data-receipt-export="true"]')?.classList.add('receipt-export-mode')
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
  if (!result) return

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

<style scoped lang="scss">
.receipt-dialog-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-bg-white);
}

.add-item-section {
  padding: 16px 20px;
  background: var(--tf-color-surface-muted);
  border-bottom: 1px solid var(--tf-color-border-muted);
  flex-shrink: 0;
}

.search-input {
  min-width: 0;
}

.add-item-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--tf-space-3);
}

.search-add-button {
  flex: none;
}

.search-results {
  margin-top: 10px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  overflow: hidden;
  max-height: 300px;
  overflow-y: auto;
}

.results-header {
  padding: 8px 12px;
  background: var(--tf-color-sky-100);
  color: var(--tf-color-sky-700);
  font-size: var(--tf-type-scale-13);
  font-weight: 500;
  border-bottom: 1px solid var(--color-primary);
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--tf-color-blue-50);
  cursor: pointer;
  border-bottom: 1px solid var(--tf-color-sky-100);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--tf-color-sky-100);
  }
}

.item-info {
  flex: 1;
  font-weight: 500;
  color: var(--color-text-primary);
}

.item-imei {
  font-size: var(--tf-type-scale-12);
  color: var(--color-text-regular);
}

.search-error {
  margin-top: 8px;
  color: var(--color-danger);
  font-size: var(--tf-type-scale-13);
}

.receipt-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--color-bg-white);
}

.sales-receipt {
  --receipt-section-inset: var(--tf-space-5);
  display: flex;
  flex-direction: column;
  padding: var(--tf-space-4) 0;
  background: var(--color-bg-white);
  border: 1px solid var(--tf-color-gray-bootstrap-300);
}

.receipt-header {
  margin-inline: var(--receipt-section-inset);
  text-align: center;
  padding: var(--tf-space-7) 0 var(--tf-space-6);
  background: var(--color-bg-white);
  border-bottom: 1px solid var(--tf-color-border-muted);
}

.receipt-title {
  margin: 0 0 var(--tf-space-5);
  color: var(--tf-color-red-700);
  font-size: var(--tf-type-scale-28);
  font-weight: 700;
}

.receipt-meta {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--tf-space-2) var(--tf-space-6);
}

.receipt-meta-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--tf-space-2);
  color: var(--tf-color-gray-bootstrap-500);
  font-size: var(--tf-type-scale-13);

  strong {
    color: var(--tf-color-gray-bootstrap-800);
    font-weight: 600;
  }
}

.party-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: var(--tf-space-5) var(--receipt-section-inset);
  background: var(--color-bg-white);
  border: 1px solid var(--tf-color-border-muted);
}

.party-panel--supplier {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--tf-space-2) var(--tf-space-4);
  padding: var(--tf-space-3) var(--tf-space-4);
}

.party-panel--supplier .party-column {
  display: contents;
}
.party-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: var(--tf-space-2);
  padding: var(--tf-space-3) var(--tf-space-4) var(--tf-space-2);
}

.party-column + .party-column {
  border-left: 1px solid var(--tf-color-border-muted);
}
.party-item {
  display: flex;
  align-items: center;
  min-width: 0;
  font-size: var(--tf-type-scale-13);
  color: var(--tf-color-gray-bootstrap-700);
}

.party-field {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--tf-space-2);
  width: 100%;
  min-width: 0;
  padding: var(--tf-space-2) 0;
  border-bottom: 1px solid var(--tf-color-gray-bootstrap-300);

  strong {
    color: var(--tf-color-red-700);
    font-size: var(--tf-type-scale-15);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
}

.party-label {
  color: var(--tf-color-gray-bootstrap-800);
  white-space: nowrap;
}

.items-list {
  margin-inline: var(--receipt-section-inset);
  padding: 0;
  background: var(--color-bg-white);
}

.sales-receipt-theme {
  --receipt-theme-accent: var(--tf-color-gray-bootstrap-900);
  --receipt-theme-heading: var(--tf-color-indigo-700);
  --receipt-theme-secondary: var(--tf-color-gray-bootstrap-600);
  --receipt-theme-border-color: var(--tf-color-gray-ant-300);
  --receipt-theme-header-background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  color: var(--receipt-theme-accent);
}

.sales-receipt-theme,
.sales-receipt-theme .party-panel,
.sales-receipt-theme .items-list,
.sales-receipt-theme .totals-bar,
.sales-receipt-theme .after-sale-notes {
  border-width: 1px;
  border-style: solid;
  border-color: var(--receipt-theme-border-color);
}

.sales-receipt-theme .party-column + .party-column,
.sales-receipt-theme .total-amount-words,
.sales-receipt-theme .total-amount {
  border-color: var(--receipt-theme-border-color);
}

.sales-receipt-theme .party-panel,
.sales-receipt-theme .after-sale-notes {
  background: var(--tf-color-neutral-25);
}

.sales-receipt-theme .totals-bar {
  background: var(--tf-color-indigo-50);
}

.sales-receipt-theme .receipt-header {
  background: var(--receipt-theme-header-background);
  border-bottom-color: transparent;
}

.transfer-receipt .receipt-header {
  background: var(--receipt-theme-header-background);
  border-bottom-color: transparent;
}

.supplier-receipt .receipt-header {
  background: var(--receipt-theme-header-background);
  border-bottom-color: transparent;
}

.sales-receipt-theme .receipt-header .receipt-title,
.sales-receipt-theme .receipt-header .receipt-meta-item,
.sales-receipt-theme .receipt-header .receipt-meta-item strong,
.transfer-receipt .receipt-header .receipt-title,
.transfer-receipt .receipt-header .receipt-meta-item,
.transfer-receipt .receipt-header .receipt-meta-item strong,
.supplier-receipt .receipt-header .receipt-title,
.supplier-receipt .receipt-header .receipt-meta-item,
.supplier-receipt .receipt-header .receipt-meta-item strong {
  color: var(--color-bg-white);
}

.sales-receipt-theme .receipt-meta-item,
.sales-receipt-theme .receipt-meta-item strong,
.sales-receipt-theme .party-label,
.sales-receipt-theme .total-count > span,
.sales-receipt-theme .after-sale-notes,
.sales-receipt-theme .after-sale-notes p,
.sales-receipt-theme .receipt-signature,
.sales-receipt-theme .receipt-signature-item strong,
.sales-receipt-theme .cell-stack span {
  color: var(--receipt-theme-secondary);
}

.sales-receipt-theme .total-amount-words,
.sales-receipt-theme .total-amount,
.sales-receipt-theme .receipt-product-name {
  color: var(--receipt-theme-accent);
}

.sales-receipt-theme .receipt-title,
.sales-receipt-theme .total-count strong,
.sales-receipt-theme .after-sale-notes > strong {
  color: var(--receipt-theme-heading);
}

.sales-receipt-theme .receipt-signature-item span {
  color: var(--tf-color-blue-700);
}

.sales-receipt-theme .receipt-meta-item .receipt-number-value {
  color: var(--receipt-theme-heading);
}

.sales-receipt-theme .receipt-meta-item .receipt-date-value {
  color: var(--tf-color-emerald-700);
}

</style>

<style scoped lang="scss">

.cell-stack {
  display: flex;
  flex-direction: column;
  gap: var(--tf-space-1);

  span {
    color: var(--tf-color-gray-bootstrap-600);
    font-size: var(--tf-type-scale-12);
  }
}

.receipt-product-name {
  color: var(--tf-color-gray-bootstrap-900);
  font-size: var(--tf-type-scale-15);
  font-weight: 600;
}

.receipt-product-amount {
  color: var(--tf-color-gray-bootstrap-800);
  font-weight: 600;
}

.totals-bar {
  display: grid;
  grid-template-columns: minmax(140px, 0.75fr) minmax(0, 2.75fr) minmax(220px, 1.5fr);
  align-items: stretch;
  box-sizing: border-box;
  flex: 0 0 var(--tf-space-7);
  height: var(--tf-space-7);
  min-height: var(--tf-space-7);
  max-height: var(--tf-space-7);
  margin: var(--tf-space-4) var(--receipt-section-inset) 0;
  padding: 0;
  background: var(--tf-color-neutral-25);
  border: 1px solid var(--tf-color-border-muted);
}

.total-count,
.total-amount-words,
.total-amount {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  gap: var(--tf-space-3);
  min-width: 0;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 0 var(--tf-space-4);
  font-size: var(--tf-type-scale-14);
  line-height: var(--tf-line-height-compact);
  color: var(--tf-color-gray-bootstrap-700);
}

.total-count > span {
  color: var(--tf-color-red-700);
  font-weight: 600;
}

.total-amount-words,
.total-amount {
  border-left: 1px solid var(--tf-color-border-muted);
}

.total-amount {
  justify-content: flex-end;
  white-space: nowrap;
}

.total-count span,
.total-amount-words span,
.total-amount span {
  white-space: nowrap;
}

.total-count strong,
.total-amount-words strong,
.total-amount strong {
  color: var(--tf-color-gray-bootstrap-900);
  font-size: var(--tf-type-scale-18);
  font-weight: 700;
}

.total-amount strong {
  color: var(--tf-color-red-700);
  font-size: var(--tf-type-scale-22);
  white-space: nowrap;
}

.total-amount-words strong {
  color: var(--tf-color-gray-bootstrap-900);
  font-weight: 700;
}

.after-sale-notes {
  margin: var(--tf-space-5) var(--receipt-section-inset) 0;
  padding: var(--tf-space-4) var(--tf-space-5);
  font-size: var(--tf-type-scale-12);
  color: var(--tf-color-gray-bootstrap-500);
  background: var(--color-bg-white);
  border: 1px solid var(--tf-color-border-muted);

  > strong {
    color: var(--tf-color-gray-bootstrap-800);
    font-weight: 700;
  }

  p {
    display: block;
    margin: var(--tf-space-1) 0 0;
    color: var(--tf-color-gray-bootstrap-600);
    text-align: left;
  }
}

.receipt-signature {
  margin: var(--tf-space-6) var(--receipt-section-inset) 0;
  padding: var(--tf-space-4) 0;
  color: var(--tf-color-gray-bootstrap-800);
  font-size: var(--tf-type-scale-13);
  border-top: 1px dashed var(--tf-color-border-muted);
}

.receipt-signature-meta {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.receipt-signature-item {
  display: flex;
  align-items: baseline;
  gap: var(--tf-space-2);
  white-space: nowrap;

  strong {
    color: var(--tf-color-gray-bootstrap-700);
    font-weight: 600;
  }
}
.transfer-receipt .receipt-title,
.transfer-receipt .total-amount strong {
  color: var(--tf-color-orange-material-500);
}
.supplier-receipt .receipt-title,
.supplier-receipt .total-amount strong {
  color: var(--tf-color-violet-500);
}
.receipt-theme--transfer .party-panel,
.receipt-theme--transfer .items-list,
.receipt-theme--transfer .totals-bar,
.receipt-theme--transfer .after-sale-notes,
.receipt-theme--supplier .party-panel,
.receipt-theme--supplier .items-list,
.receipt-theme--supplier .totals-bar,
.receipt-theme--supplier .after-sale-notes {
  border-width: 1px;
  border-style: solid;
  border-color: var(--tf-color-gray-ant-300);
}

.receipt-theme--transfer .party-column + .party-column,
.receipt-theme--transfer .total-amount-words,
.receipt-theme--transfer .total-amount,
.receipt-theme--supplier .party-column + .party-column,
.receipt-theme--supplier .total-amount-words,
.receipt-theme--supplier .total-amount {
  border-color: var(--tf-color-gray-ant-300);
}
.receipt-theme--transfer .party-panel,
.receipt-theme--transfer .after-sale-notes {
  background: var(--tf-color-blue-50);
}
.receipt-theme--transfer .totals-bar {
  background: var(--tf-color-blue-100);
}
.receipt-theme--supplier .party-panel,
.receipt-theme--supplier .after-sale-notes {
  background: var(--tf-color-teal-50);
}
.receipt-theme--supplier .totals-bar {
  background: var(--tf-color-emerald-50);
}
.receipt-theme--transfer .party-label,
.receipt-theme--transfer .total-count > span,
.receipt-theme--transfer .after-sale-notes,
.receipt-theme--transfer .after-sale-notes p,
.receipt-theme--transfer .receipt-signature,
.receipt-theme--transfer .receipt-signature-item strong,
.receipt-theme--transfer .cell-stack span,
.receipt-theme--supplier .party-label,
.receipt-theme--supplier .total-count > span,
.receipt-theme--supplier .after-sale-notes,
.receipt-theme--supplier .after-sale-notes p,
.receipt-theme--supplier .receipt-signature,
.receipt-theme--supplier .receipt-signature-item strong,
.receipt-theme--supplier .cell-stack span {
  color: var(--tf-color-gray-bootstrap-600);
}

.receipt-theme--transfer {
  --receipt-export-accent: var(--tf-color-blue-700);
  --receipt-theme-header-background: linear-gradient(135deg, var(--tf-color-blue-600) 0%, var(--tf-color-sky-700) 100%);
}

.receipt-theme--supplier {
  --receipt-export-accent: var(--tf-color-teal-700);
  --receipt-theme-header-background: linear-gradient(135deg, var(--tf-color-teal-500) 0%, var(--tf-color-emerald-700) 100%);
}

.receipt-theme--sales {
  --receipt-export-accent: var(--tf-color-indigo-700);
}

.sales-receipt .party-value,
.sales-receipt .receipt-product-amount,
.sales-receipt .total-amount strong,
.sales-receipt .after-sale-notes > strong,
.sales-receipt .receipt-signature-item span {
  color: transparent;
  background-image: var(--receipt-theme-header-background);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sales-receipt .total-count strong,
.sales-receipt .total-amount-words strong {
  color: var(--tf-color-red-700);
  background-image: none;
  -webkit-text-fill-color: currentColor;
}

.sales-receipt.receipt-export-mode .party-value,
.sales-receipt.receipt-export-mode .receipt-product-amount,
.sales-receipt.receipt-export-mode .total-amount strong,
.sales-receipt.receipt-export-mode .after-sale-notes > strong,
.sales-receipt.receipt-export-mode .receipt-signature-item span {
  color: var(--receipt-export-accent);
  background-image: none;
  background-clip: border-box;
  -webkit-text-fill-color: var(--receipt-export-accent);
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

@media (max-width: 767px) {
  .sales-receipt {
    --receipt-section-inset: var(--tf-space-4);
  }

  .receipt-header {
    padding-block: var(--tf-space-5);
  }

  .receipt-title {
    font-size: var(--tf-type-scale-22);
  }

  .receipt-meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-content: stretch;
    gap: var(--tf-space-2) var(--tf-space-3);
  }

  .receipt-meta-item {
    flex-wrap: wrap;
  }
  .party-panel {
    grid-template-columns: minmax(0, 1fr);
  }

  .party-panel--supplier {
    grid-template-columns: minmax(0, 1fr);
    padding-inline: var(--tf-space-3);
  }
  .party-column + .party-column {
    border-top: 1px solid var(--tf-color-border-muted);
    border-left: 0;
  }

  .party-item {
    gap: var(--tf-space-4);
  }

  .totals-bar {
    grid-template-columns: minmax(0, 1fr);
    flex: 0 0 auto;
    height: auto;
    min-height: 0;
    max-height: none;
  }

  .total-amount-words,
  .total-amount {
    border-top: 1px solid var(--tf-color-border-muted);
    border-left: 0;
  }

  .total-amount {
    justify-content: flex-start;
  }

  .total-amount strong {
    font-size: var(--tf-type-scale-18);
  }

  .receipt-signature {
    padding-block: var(--tf-space-4);
  }

}

@media (max-width: 479px) {
  .sales-receipt {
    --receipt-section-inset: var(--tf-space-3);
  }

  .add-item-section {
    padding: var(--tf-space-3) var(--tf-space-4);
  }

  .receipt-header {
    padding-inline: var(--tf-space-3);
  }

  .receipt-meta {
    grid-template-columns: minmax(0, 1fr);
  }

  .party-column {
    padding-inline: var(--tf-space-3);
  }

  .after-sale-notes {
    padding-inline: var(--tf-space-3);
  }

  .totals-bar {
    grid-template-columns: minmax(0, 1fr);
  }

  .receipt-signature {
    padding-inline: 0;
  }

  .party-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--tf-space-2);
  }

  .party-field {
    width: 100%;
  }

  .totals-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .receipt-title {
    font-size: var(--tf-type-scale-19);
  }
}
</style>

<style lang="scss">
.sales-receipt-dialog {
  --dialog-max-width: 960px;
  --tf-dialog-surface: var(--color-bg-white);
  --tf-dialog-footer-bg: var(--color-bg-white);
  --tf-dialog-body-padding-inline: 0px;
  --tf-dialog-body-padding-block: 0px;
  --tf-dialog-footer-padding-inline: var(--tf-space-5);
  --tf-dialog-footer-padding-block-start: var(--tf-space-4);
  --tf-dialog-footer-padding-block-end: var(--tf-space-5);
}

@media (max-width: 767px) {
  .sales-receipt-dialog {
    --dialog-side-gap: var(--tf-space-3);
  }
}
</style>
