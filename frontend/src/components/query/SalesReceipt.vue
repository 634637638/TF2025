<template>
  <MobileDialog
    :model-value="visible"
    :title="modalTitle"
    width="680px"
    dialog-class="sales-receipt-dialog"
    :show-default-footer="false"
    @update:model-value="handleDialogVisibility"
    @close="handleClose"
  >
    <div class="receipt-dialog-shell">
      <div class="add-item-section">
        <el-input
          v-model="searchKeyword"
          placeholder="输入IMEI或序列号搜索添加..."
          class="search-input"
          clearable
          @keyup.enter="handleSearchAndAdd"
          @clear="handleSearchClear"
        >
          <template #append>
            <el-button
              :loading="isSearching"
              @click="handleSearchAndAdd"
            >
              <i class="fas fa-search" />
              搜索添加
            </el-button>
          </template>
        </el-input>

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
            <span class="item-price">¥{{ result.sale_price }}</span>
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
          :class="receiptClass"
        >
          <div class="receipt-header">
            <h1 class="receipt-title">
              {{ receiptTitle }}
            </h1>
            <div class="receipt-meta">
              <span>{{ receiptNumber }}</span>
              <span class="separator">·</span>
              <span>{{ receiptDate }}</span>
            </div>
          </div>

          <div
            v-if="hasCustomerInfo || showSupplierInfo || showSupplierReceiverInfo"
            class="info-bar"
          >
            <span
              v-if="hasCustomerInfo"
              class="info-tag"
            >
              <i class="fas fa-user" />
              {{ customerName }}<span v-if="customerPhone"> · {{ customerPhone }}</span>
            </span>
            <span
              v-if="showSupplierInfo"
              class="info-tag"
            >
              <i class="fas fa-truck" />
              {{ supplierName }}
            </span>
            <span
              v-if="showSupplierReceiverInfo"
              class="info-tag"
            >
              <i class="fas fa-user-check" />
              接收方：{{ customerName }}<span v-if="customerPhone"> · 手机号码：{{ customerPhone }}</span>
            </span>
          </div>

          <div class="items-list">
            <div
              v-for="(item, index) in items"
              :key="index"
              class="item-row"
            >
              <div class="item-content">
                <div class="item-header">
                  <span class="item-name">{{ item.brand }} {{ item.model }}</span>
                  <span class="item-price">¥{{ formatPrice(item.salePrice) }}</span>
                </div>

                <div class="item-tags">
                  <span class="tag">{{ item.color }}</span>
                  <span class="tag">{{ item.memory }}</span>
                  <span :class="['tag', 'condition', item.isNew === 1 ? 'new' : 'used']">
                    {{ item.isNew === 1 ? '全新' : '二手' }}
                  </span>
                </div>

                <div class="item-codes">
                  <span class="code">IMEI: {{ item.imei }}</span>
                  <span class="code">SN: {{ item.serialNumber }}</span>
                  <span class="code">{{ formatItemSaleDate(item.saleDate) }}</span>
                  <span class="code">{{ item.storeName || '-' }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="totals-bar">
            <span class="total-label">共 {{ items.length }} 台</span>
            <span class="total-amount">¥{{ formatPrice(totalAmount) }}</span>
          </div>

          <div class="receipt-footer">
            <span>{{ storeName || '-' }}</span>
            <span class="dot">·</span>
            <span>{{ salesOperator || '-' }}</span>
            <span class="dot">·</span>
            <span>{{ receiptNote }}</span>
          </div>
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
          保存图片
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
import { computed, ref } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import type { CloseEmits, VisibleProps } from '@/types/component'
import { logger } from '@/utils/logger'
import { loadHtml2Canvas } from '@/utils/html2canvas'
import { useSiteSettingsStore } from '@/stores/siteSettings'

interface ReceiptItem {
  phone_id: number
  brand: string
  model: string
  color: string
  memory: string
  imei: string
  serialNumber: string
  purchasePrice: number
  salePrice: number
  isNew: number
  purchaseDate?: string
  saleDate?: string
  storeName?: string
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
  purchaseDate?: string
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
  saleDate: '',
  purchaseDate: ''
})
const siteSettingsStore = useSiteSettingsStore()

interface Emits extends CloseEmits {
  addItem: [item: SearchPhoneResult]
}

const emit = defineEmits<Emits>()

const receiptRef = ref<HTMLElement>()
const isDownloading = ref(false)
const searchKeyword = ref('')
const searchResults = ref<SearchPhoneResult[]>([])
const searchError = ref('')
const isSearching = ref(false)

const receiptConfig = computed(() => {
  switch (props.status) {
  case 'peer_transfer':
    return { title: '调货单', class: 'transfer-receipt', note: '本单据为调货凭证，请妥善保管' }
  case 'supplier_proxy':
    return { title: '划拨单', class: 'supplier-receipt', note: '本单据为代供应商划拨凭证' }
  default:
    return { title: `${siteSettingsStore.settings.siteName || '销售'}销售凭据`, class: 'sales-receipt-theme', note: '本单据为销售凭证，请妥善保管' }
  }
})

const receiptTitle = computed(() => receiptConfig.value.title)
const receiptClass = computed(() => receiptConfig.value.class)
const receiptNote = computed(() => receiptConfig.value.note)
const modalTitle = computed(() => receiptConfig.value.title)
const receiptNumber = computed(() => props.receiptNumber || '待生成')
const receiptDate = computed(() => props.saleDate
  ? TimeUtil.format(props.saleDate, TIME_FORMATS.DATE)
  : TimeUtil.nowFormatted(TIME_FORMATS.DATE))

const hasCustomerInfo = computed(() => Boolean((props.status === 'sold' || props.status === 'peer_transfer') && props.customerName))
const showSupplierInfo = computed(() => Boolean(props.status === 'supplier_proxy' && props.supplierName))
const showSupplierReceiverInfo = computed(() => Boolean(props.status === 'supplier_proxy' && props.customerName))

const totalAmount = computed(() => props.items.reduce((sum, item) => sum + (Number(item.salePrice) || 0), 0))

const formatItemSaleDate = (dateString?: string) => {
  if (!dateString || dateString.trim() === '') return '-'
  try {
    return TimeUtil.format(dateString, TIME_FORMATS.DATE)
  } catch {
    return '-'
  }
}

const formatPrice = (price: number) => {
  const numValue = Number(price || 0)
  if (Number.isInteger(numValue)) {
    return numValue.toString()
  }
  const decimals = numValue.toString().split('.')[1]?.length || 0
  return numValue.toFixed(decimals > 2 ? 2 : decimals)
}

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
  const printWindow = window.open('', '', 'width=800,height=600')
  if (!printWindow) return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${receiptTitle.value}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Microsoft YaHei', sans-serif; padding: 20px; }
        .receipt-title { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .receipt-meta { text-align: center; color: var(--text-secondary); margin-bottom: 5px; }
        .info-bar { display: flex; gap: 12px; margin-bottom: 16px; padding: 12px; background: var(--tf-color-surface-muted); border-radius: 8px; }
        .info-tag { font-size: 13px; color: var(--text-primary); }
        .items-list { display: flex; flex-direction: column; gap: 12px; }
        .item-row { border: 1px solid var(--tf-color-gray-200); border-radius: 10px; padding: 14px; }
        .item-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .item-name { font-size: 15px; font-weight: 600; }
        .item-price { font-size: 18px; font-weight: 700; }
        .item-tags { display: flex; gap: 6px; margin-bottom: 8px; }
        .tag { padding: 3px 10px; background: var(--tf-color-gray-200); border-radius: 4px; font-size: 12px; }
        .item-codes { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 12px; color: var(--text-secondary); }
        .totals-bar { display: flex; justify-content: space-between; padding: 16px 20px; background: var(--tf-color-surface-muted); border-radius: 10px; }
        .total-amount { font-size: 24px; font-weight: 700; }
        .receipt-footer { text-align: center; font-size: 13px; color: var(--text-muted); padding-top: 12px; border-top: 1px solid var(--tf-color-gray-200); }
      </style>
    </head>
    <body>${printContent}</body>
    </html>
  `)
  printWindow.document.close()
  printWindow.print()
}

const downloadImage = async () => {
  if (!receiptRef.value) return

  try {
    isDownloading.value = true
    const html2canvas = await loadHtml2Canvas()
    const canvas = await html2canvas(receiptRef.value, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false
    })
    const link = document.createElement('a')
    link.download = `${receiptTitle.value}_${receiptNumber.value}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
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
  width: 100%;
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
  font-size: 13px;
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
  font-size: 12px;
  color: var(--color-text-regular);
}

.search-error {
  margin-top: 8px;
  color: var(--color-danger);
  font-size: 13px;
}

.receipt-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--color-bg-white);
}

.sales-receipt {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-white);
}

.receipt-header {
  text-align: center;
  padding: 24px 28px 20px;
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  color: var(--color-bg-white);
}

.receipt-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
}

.receipt-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

.separator {
  color: rgba(255, 255, 255, 0.5);
}

.info-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 28px;
  background: var(--tf-color-surface-muted);
  border-bottom: 1px solid var(--tf-color-border-muted);
}

.info-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--tf-color-gray-bootstrap-700);
  font-weight: 500;

  i {
    color: var(--tf-color-indigo-brand);
  }
}

.items-list {
  display: flex;
  flex-direction: column;
  padding: 20px 28px;
  background: var(--color-bg-white);
}

.item-row {
  padding: 16px 0;
  border-bottom: 1px dashed var(--tf-color-border-muted);

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
}

.item-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.item-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--tf-color-gray-bootstrap-900);
}

.item-price {
  flex-shrink: 0;
  padding: 4px 12px;
  font-size: 24px;
  font-weight: 800;
  color: var(--tf-color-indigo-brand);
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  border: 2px solid rgba(102, 126, 234, 0.15);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  display: inline-block;
  padding: 4px 12px;
  background: var(--tf-color-border-muted);
  color: var(--tf-color-gray-bootstrap-700);
  font-size: 12px;
  border-radius: 6px;
  font-weight: 500;
}

.tag.condition.new {
  background: var(--tf-color-success-legacy);
  color: var(--tf-color-success-text-legacy);
}

.tag.condition.used {
  background: var(--tf-color-warning-legacy);
  color: var(--tf-color-warning-text-legacy);
}

.item-codes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding-top: 4px;
  font-size: 12px;
  color: var(--tf-color-muted);
}

.code {
  white-space: nowrap;

  &::before {
    content: '•';
    color: var(--tf-color-border-subtle);
    margin-right: 4px;
  }

  &:first-child::before {
    display: none;
  }
}

.totals-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 28px;
  background: linear-gradient(135deg, var(--tf-color-surface-muted) 0%, var(--tf-color-border-muted) 100%);
  border-top: 1px solid var(--tf-color-border-subtle);
  border-bottom: 1px solid var(--tf-color-border-subtle);
}

.total-label {
  font-size: 14px;
  color: var(--tf-color-gray-bootstrap-700);
  font-weight: 500;
}

.total-amount {
  padding: 8px 16px;
  font-size: 32px;
  font-weight: 900;
  color: var(--tf-color-indigo-brand);
  background: var(--color-bg-white);
  border: 3px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
}

.receipt-footer {
  text-align: center;
  padding: 16px 28px;
  font-size: 12px;
  color: var(--tf-color-gray-bootstrap-500);
  background: var(--tf-color-surface-muted);
}

.dot {
  margin: 0 6px;
  color: var(--tf-color-border-subtle);
}

.transfer-receipt .receipt-header {
  background: linear-gradient(135deg, var(--tf-color-orange-material-500) 0%, var(--tf-color-orange-material-700) 100%);
}

.transfer-receipt .info-tag i {
  color: var(--tf-color-orange-material-500);
}

.transfer-receipt .item-price,
.transfer-receipt .total-amount {
  color: var(--tf-color-orange-material-500);
}

.supplier-receipt .receipt-header {
  background: linear-gradient(135deg, var(--tf-color-violet-500) 0%, var(--tf-color-fuchsia-500) 100%);
}

.supplier-receipt .info-tag i {
  color: var(--tf-color-violet-500);
}

.supplier-receipt .item-price,
.supplier-receipt .total-amount {
  color: var(--tf-color-violet-500);
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

@media (max-width: 768px) {
  .receipt-header {
    padding: 16px 20px;
  }

  .receipt-title {
    font-size: 18px;
  }

  .info-bar {
    padding: 12px 16px;
    flex-direction: column;
    gap: 8px;
  }

  .items-list {
    padding: 16px 20px;
  }

  .item-name {
    font-size: 14px;
  }

  .item-price {
    font-size: 18px;
  }

  .totals-bar {
    padding: 14px 20px;
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }

  .total-amount {
    font-size: 22px;
  }

  .receipt-footer {
    padding: 12px 20px;
    font-size: 11px;
  }

  .action-buttons {
    flex-direction: column;
  }

}

@media (max-width: 480px) {
  .add-item-section {
    padding: 14px 16px;
  }

  .receipt-header,
  .items-list,
  .totals-bar,
  .receipt-footer {
    padding-left: 16px;
    padding-right: 16px;
  }

  .receipt-title {
    font-size: 16px;
  }

  .item-codes {
    font-size: 11px;
    gap: 4px 12px;
  }

  .total-amount {
    font-size: 20px;
  }
}
</style>

<style lang="scss">
.sales-receipt-dialog {
  --dialog-max-width: 720px;
}

.sales-receipt-dialog .el-dialog__body {
  padding: 0 !important;
  background: var(--color-bg-white) !important;
}

.sales-receipt-dialog .el-dialog__footer {
  padding: 16px 20px 20px !important;
  background: var(--color-bg-white) !important;
}

@media (max-width: 768px) {
  .sales-receipt-dialog {
    --dialog-side-gap: 12px;
  }
}
</style>
