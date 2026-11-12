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
                :width="$getNumberColumnWidth((items || []).map((_row, $index) => $index + 1), 68)"
                align="center"
              >
                <template #default="{ $index }">
                  <span class="table-number-badge">{{ $index + 1 }}</span>
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
                <template #default>
                  1
                </template>
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

export interface ReceiptItem {
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

export interface SearchPhoneResult {
  id: number
  phone_id?: number
  brand?: string
  brand_name?: string
  model?: string
  model_name?: string
  color?: string
  color_name?: string
  memory?: string
  memory_size?: string
  imei?: string
  serial_number?: string
  sale_price?: number | string
  price?: number | string
  is_new?: number
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

<style scoped lang="scss" src="./styles/sales-receipt/layout.scss"></style>
<style scoped lang="scss" src="./styles/sales-receipt/theme.scss"></style>

<style scoped lang="scss" src="./styles/sales-receipt/content.scss"></style>
<style scoped lang="scss" src="./styles/sales-receipt/responsive.scss"></style>
