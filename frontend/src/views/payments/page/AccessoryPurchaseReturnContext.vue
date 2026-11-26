<template>
  <MobileDialog
    :model-value="visible && canViewReturnContext"
    title="采购退供核对"
    width="1000px"
    :show-default-footer="false"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="tf-dialog-toolbar">
      <el-button
        v-permission="{ permission: ['supplier-payments:view', 'accessories:view'], mode: 'all' }"
        :disabled="loading"
        @click="refresh"
      >
        重新核对
      </el-button>
    </div>
    <SectionLoading
      v-if="loading && !context"
      text="正在核对原采购、付款与批次库存..."
    />
    <DataEmptyState
      v-else-if="failed"
      state="error"
      title="退供核对失败"
      description="请重新核对；采购金额、付款或库存流水存在差异时须先处理。"
      action-text="重试"
      @action="load"
    />
    <div
      v-else-if="context"
      v-tf-loading="{ active: loading, text: '正在重新核对原单...' }"
    >
      <el-alert
        title="本页仅核对原采购及授权门店内的剩余批次，不执行退供、退款或应付冲减。"
        type="info"
        :closable="false"
      />
      <section class="detail-section">
        <h3>原采购单</h3>
        <RecordDescriptions
          :column="3"
          border
        >
          <el-descriptions-item
            v-if="purchaseVisible('purchase.batch_no')"
            label="采购批次"
            :span="3"
          >
            {{ context.purchase.batch_no ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="purchaseVisible('purchase.name')"
            :label="context.purchase.has_snapshot ? '商品名称（入库时）' : '商品名称（当前档案）'"
            :span="3"
          >
            {{ context.purchase.name ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="原供应商">
            {{ context.purchase.supplier_name ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="原入库店铺">
            {{ context.purchase.store_name ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="purchaseVisible('payment.brand_name')"
            label="实际品牌"
          >
            {{ context.purchase.brand_name ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="purchaseVisible('payment.model_name')"
            label="配件型号"
            :span="3"
          >
            {{ context.purchase.product_model ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="原采购数量">
            {{ context.purchase.quantity }}
          </el-descriptions-item>
          <el-descriptions-item label="原采购单价">
            ¥{{ formatAmount(context.purchase.purchase_cost) }}
          </el-descriptions-item>
          <el-descriptions-item label="原整批金额">
            ¥{{ formatAmount(context.purchase.total_amount) }}
          </el-descriptions-item>
          <el-descriptions-item label="打款状态">
            {{ context.purchase.payment_status === 'paid' ? '已打款' : '未打款' }}
          </el-descriptions-item>
          <el-descriptions-item label="有效已登记货款">
            ¥{{ formatAmount(context.purchase.paid_amount) }}
          </el-descriptions-item>
          <el-descriptions-item label="原单待打款">
            ¥{{ formatAmount(context.purchase.unpaid_amount) }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="purchaseVisible('purchase.inventory_time')"
            label="原入库时间"
          >
            {{ formatDateTime(context.purchase.inventory_time) }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="purchaseVisible('purchase.inventory_operator')"
            label="原入库员"
          >
            {{ context.purchase.inventory_operator_name ?? '-' }}
          </el-descriptions-item>
        </RecordDescriptions>
      </section>
      <section class="detail-section">
        <h3>原批次当前库存</h3>
        <el-alert
          v-if="context.ledger_status === 'untracked'"
          title="该历史采购缺少完整的原入库批次流水，无法确认可退数量，请先核对原始资料。"
          type="warning"
          :closable="false"
        />
        <template v-else>
          <p>授权门店内本批次剩余 {{ context.current_quantity }} 件；其他门店不在本页统计范围。</p>
          <el-table
            v-table-double-tap="detailTapOptions"
            :data="context.data"
            class="data-table"
            row-key="row_key"
            @row-dblclick="detailDoubleClick"
          >
            <el-table-column
              label="当前门店"
              prop="store_name"
              min-width="130"
            />
            <el-table-column
              label="剩余数量"
              prop="quantity"
              min-width="100"
            />
            <el-table-column
              v-if="stockVisible('purchase_cost')"
              label="原采购单价"
              min-width="120"
            >
              <template #default="{ row }">
                {{ costText(row) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="stockVisible('usage_type')"
              label="库存用途"
              min-width="110"
            >
              <template #default="{ row }">
                {{ usageText(row) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="stockVisible('serial_tracking')"
              label="管理方式"
              min-width="110"
            >
              <template #default="{ row }">
                {{ trackingText(row) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canQuoteReturn"
              label="待退数量"
              min-width="150"
            >
              <template #default="{ row }">
                <el-input-number
                  v-if="row.serial_tracking === 0"
                  :model-value="clearedBatchRows.has(row.row_key) ? null : batchDraft.get(row.row_key)?.quantity ?? 0"
                  :aria-label="`${row.store_name ?? '当前门店'}待退数量`"
                  :min="0"
                  :max="Number(row.quantity)"
                  :step="1"
                  :precision="0"
                  :controls="false"
                  :disabled="loading"
                  @update:model-value="setBatchQuantity(row, $event)"
                />
                <span v-else>请在下方选择SN</span>
              </template>
            </el-table-column>
            <template #empty>
              <DataEmptyState
                description="授权门店内本批次暂无剩余库存"
                size="compact"
              />
            </template>
          </el-table>
          <Pagination
            :current="page"
            :page-size="pageSize"
            :total="context.pagination.total"
            :disabled="loading"
            :show-page-sizes="false"
            @change="changePage"
          />
        </template>
      </section>
      <section
        v-if="context.ledger_status === 'verified' && stockVisible('serial_number') && context.serials"
        class="detail-section"
      >
        <h3>原采购在库SN</h3>
        <div
          role="search"
          aria-label="原采购SN检索"
        >
          <el-input
            v-model="serialKeyword"
            v-identifier-input="'accessory-serial'"
            aria-label="SN序列号"
            clearable
            maxlength="100"
            placeholder="检索本批次在库SN"
            @keyup.enter="searchSerials"
            @clear="searchSerials"
          >
            <template #append>
              <SearchActionButton
                :loading="loading"
                @click="searchSerials"
              >
                搜索SN
              </SearchActionButton>
            </template>
          </el-input>
        </div>
        <el-table
          v-table-double-tap="serialDetailTapOptions"
          :data="context.serials.data"
          class="data-table"
          row-key="id"
          @row-dblclick="serialDetailDoubleClick"
        >
          <el-table-column
            v-if="canQuoteReturn"
            label="待退"
            width="80"
          >
            <template #default="{ row }">
              <el-checkbox
                :model-value="serialDraft.has(row.id)"
                :aria-label="`选择SN ${row.serial_number}`"
                :disabled="loading"
                @update:model-value="toggleSerial(row)"
              />
            </template>
          </el-table-column>
          <el-table-column
            label="SN序列号"
            prop="serial_number"
            min-width="180"
          />
          <el-table-column
            label="当前门店"
            prop="store_name"
            min-width="130"
          />
          <template #empty>
            <DataEmptyState
              description="本批次在授权门店内暂无匹配的在库SN"
              size="compact"
            />
          </template>
        </el-table>
        <Pagination
          :current="serialPage"
          :page-size="pageSize"
          :total="context.serials.pagination.total"
          :disabled="loading"
          :show-page-sizes="false"
          @change="changeSerialPage"
        />
      </section>
      <section
        v-if="canQuoteReturn && context.ledger_status === 'verified'"
        class="detail-section"
      >
        <h3>退供试算</h3>
        <p>已选普通批次 {{ batchDraft.size }} 条、SN {{ serialDraft.size }} 件，共 {{ draftQuantity }} 件（保留跨页选择）。</p>
        <el-form
          v-if="context.purchase.payment_status === 'paid'"
          class="tf-form-layout"
          :label-position="isMobile ? 'top' : 'right'"
          :class="{ 'tf-dialog-form': isMobile, 'tf-dialog-form--stacked': isMobile }"
        >
          <el-form-item label="退供资金方式">
            <el-radio-group
              v-model="paidSettlementMode"
              class="tf-state-selector"
              aria-label="退供资金方式"
              :disabled="loading"
            >
              <el-radio value="supplier_refund">
                供应商退款
              </el-radio>
              <el-radio value="supplier_credit">
                留抵后续货款
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
        <p v-else>
          未付款采购退供按原采购价试算拟冲减应付金额。
        </p>
        <div class="tf-dialog-toolbar">
          <el-button
            v-permission="{ permission: ['supplier-payments:view', 'accessories:view'], mode: 'all' }"
            type="primary"
            :loading="quoting"
            :disabled="loading || !draftQuantity || quoting"
            @click="calculateQuote"
          >
            按原采购价试算
          </el-button>
          <el-button
            :disabled="!draftQuantity"
            @click="clearSelection"
          >
            清空选择
          </el-button>
        </div>
        <el-alert
          v-if="selectionError"
          :title="selectionError"
          type="warning"
          :closable="false"
        />
        <DataEmptyState
          v-if="quoteFailed"
          state="error"
          title="退供试算失败"
          description="请重新核对原批次和在库SN，库存或付款记录变化后须重新试算。"
          action-text="重试试算"
          @action="calculateQuote"
        />
        <div
          v-if="quote"
          role="status"
        >
          <RecordDescriptions
            :column="2"
            border
          >
            <el-descriptions-item label="待退数量">
              {{ quote.quantity }} 件
            </el-descriptions-item>
            <el-descriptions-item label="原采购单价">
              ¥{{ formatAmount(quote.purchase_cost) }}
            </el-descriptions-item>
            <el-descriptions-item label="原采购价试算金额">
              ¥{{ formatAmount(quote.total_amount) }}
            </el-descriptions-item>
            <el-descriptions-item label="打款状态">
              {{ quote.payment_status === 'paid' ? '已打款' : '未打款' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="quote.settlement"
              :label="quote.settlement.mode === 'reduce_payable' ? '拟冲减应付' : quote.settlement.mode === 'supplier_refund' ? '拟收供应商退款' : '拟留抵后续货款'"
              :span="2"
            >
              ¥{{ formatAmount(quote.settlement.mode === 'reduce_payable' ? quote.settlement.payable_reduction : quote.settlement.mode === 'supplier_refund' ? quote.settlement.refund_amount : quote.settlement.credit_amount) }}
            </el-descriptions-item>
          </RecordDescriptions>
          <RecordDescriptions
            v-for="row in quote.data"
            :key="row.row_key"
            :column="2"
            border
          >
            <el-descriptions-item label="当前门店">
              {{ row.store_name ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="待退数量">
              {{ row.quantity }} 件
            </el-descriptions-item>
            <el-descriptions-item label="库存用途">
              {{ usageText(row) }}
            </el-descriptions-item>
            <el-descriptions-item label="管理方式">
              {{ trackingText(row) }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="row.serial_numbers.length"
              label="SN"
              :span="2"
            >
              <div class="tf-record-details__field">
                {{ row.serial_numbers.join('、') }}
              </div>
            </el-descriptions-item>
          </RecordDescriptions>
          <el-alert
            title="仅为原采购价试算，不代表已退供、已退款或已冲减应付，也不占用库存。"
            type="info"
            :closable="false"
          />
        </div>
      </section>
    </div>
    <RecordDetailDialog
      v-model="detailVisible"
      title="原采购当前批次"
      :record="detailRow"
      :fields="detailFields"
      :has-actions="false"
    />
    <RecordDetailDialog
      v-model="serialDetailVisible"
      title="原采购在库SN"
      :record="serialDetailRow"
      :fields="serialDetailFields"
      :has-actions="false"
    />
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getAccessoryPurchaseReturnContext, quoteAccessoryPurchaseReturn } from '@/api/accessory-purchases'
import { useAccessoryPurchaseReturnPermissions } from '@/composables/useAccessoryPurchaseReturnPermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import { canViewAccessoryField as stockVisible } from '@/components/accessory-field-permissions'
import { formatAmount, formatDateTime } from '@/utils/format'
import { isMoneyInput } from '@/utils/security'
import type { AccessoryPurchaseReturnContext, AccessoryPurchaseReturnQuote, AccessoryPurchaseReturnQuoteInput } from '@/types/accessory'
import type { RecordDetailField } from '@/types/component'

const props = defineProps<{ visible: boolean; purchaseId: number }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()
const { canViewReturnContext, canQuoteReturn, purchaseVisible } = useAccessoryPurchaseReturnPermissions()
const context = ref<AccessoryPurchaseReturnContext | null>(null)
const page = ref(1), pageSize = 20
const serialPage = ref(1), serialKeyword = ref(''), serialSearch = ref('')
const loading = ref(false), failed = ref(false)
const requests = useLatestRequest()
type Batch = AccessoryPurchaseReturnContext['data'][number]
type Serial = NonNullable<AccessoryPurchaseReturnContext['serials']>['data'][number]
const batchDraft = ref(new Map<string, Batch>())
const clearedBatchRows = ref(new Set<string>())
const serialDraft = ref(new Map<number, Serial>())
const quote = ref<AccessoryPurchaseReturnQuote | null>(null)
const paidSettlementMode = ref<'supplier_refund' | 'supplier_credit'>('supplier_refund')
const quoting = ref(false), quoteFailed = ref(false), selectionError = ref('')
const quoteRequests = useLatestRequest()
const draftQuantity = computed(() => [...batchDraft.value.values()].reduce((sum, row) => sum + Number(row.quantity), serialDraft.value.size))
const invalidateQuote = () => { quoteRequests.cancelLatest(); quote.value = null; quoting.value = false; quoteFailed.value = false; selectionError.value = '' }
watch(paidSettlementMode, invalidateQuote, { flush: 'sync' })
const clearSelection = () => { invalidateQuote(); batchDraft.value.clear(); clearedBatchRows.value.clear(); serialDraft.value.clear() }
const setBatchQuantity = (row: Batch, value: number | null | undefined) => {
  invalidateQuote()
  if (!canQuoteReturn.value || loading.value || row.serial_tracking !== 0) return
  if (value === null || value === undefined) clearedBatchRows.value.add(row.row_key)
  else clearedBatchRows.value.delete(row.row_key)
  if (value === null || value === undefined || value === 0) { batchDraft.value.delete(row.row_key); return }
  if (!Number.isSafeInteger(value) || value < 1 || value > Number(row.quantity) || (!batchDraft.value.has(row.row_key) && batchDraft.value.size >= 100)) {
    selectionError.value = '请填写有效待退数量，每次最多选择100条普通批次。'; return
  }
  batchDraft.value.set(row.row_key, { ...row, quantity: value })
}
const toggleSerial = (row: Serial) => {
  invalidateQuote()
  if (!canQuoteReturn.value || !stockVisible('serial_number') || loading.value) return
  if (serialDraft.value.has(row.id)) serialDraft.value.delete(row.id)
  else if (serialDraft.value.size < 1000) serialDraft.value.set(row.id, { ...row })
  else selectionError.value = '每次最多选择1000件SN。'
}
const calculateQuote = async () => {
  if (!props.visible || !canQuoteReturn.value || loading.value || quoting.value || !draftQuantity.value || !context.value || context.value.ledger_status !== 'verified') return
  const input: AccessoryPurchaseReturnQuoteInput = {
    batches: [...batchDraft.value.values()].map(row => ({ row_key: row.row_key, quantity: Number(row.quantity) })), serial_ids: [...serialDraft.value.keys()],
    settlement_mode: context.value.purchase.payment_status === 'paid' ? paidSettlementMode.value : 'reduce_payable'
  }
  if ((!stockVisible('serial_number') && input.serial_ids.length) || input.batches.length > 100 || input.serial_ids.length > 1000) return
  const request = quoteRequests.nextRequest(), expectedQuantity = draftQuantity.value
  const expectedCost = Math.round(Number(context.value.purchase.purchase_cost) * 100)
  quote.value = null; quoteFailed.value = false; quoting.value = true
  try {
    const response = await quoteAccessoryPurchaseReturn(props.purchaseId, input, request.signal)
    if (!request.isLatest()) return
    const result = response.data
    const settlement = result?.settlement
    if (!response.success || !result || result.preview_only !== true || result.purchase_id !== props.purchaseId || result.quantity !== expectedQuantity ||
      !isMoneyInput(result.purchase_cost) || Math.round(Number(result.purchase_cost) * 100) !== expectedCost ||
      !isMoneyInput(result.total_amount) || Math.round(Number(result.total_amount) * 100) !== expectedCost * expectedQuantity ||
      result.payment_status !== context.value?.purchase.payment_status || !Number.isSafeInteger(result.latest_event_id) || result.latest_event_id < 0 ||
      !settlement || settlement.mode !== input.settlement_mode ||
      (['payable_reduction', 'refund_amount', 'credit_amount'] as const).some(key =>
        !isMoneyInput(settlement[key]) || Math.round(Number(settlement[key]) * 100) !==
          ((key === 'payable_reduction' && settlement.mode === 'reduce_payable' || key === 'refund_amount' && settlement.mode === 'supplier_refund' ||
            key === 'credit_amount' && settlement.mode === 'supplier_credit') ? expectedCost * expectedQuantity : 0)) ||
      !Array.isArray(result.data) || !result.data.length || new Set(result.data.map(row => row?.row_key)).size !== result.data.length ||
      result.data.some(row => !row || !Number.isSafeInteger(row.store_id) || row.store_id < 1 ||
        (row.store_name !== null && typeof row.store_name !== 'string') || !Number.isSafeInteger(row.quantity) || row.quantity < 1 ||
        !['sale', 'gift', 'unclassified'].includes(row.usage_type ?? '') || ![0, 1].includes(row.serial_tracking ?? -1) ||
        !Array.isArray(row.serial_numbers) || row.serial_numbers.some(sn => typeof sn !== 'string' || !sn.trim()) ||
        (row.serial_tracking === 0 ? row.serial_numbers.length !== 0 || !input.batches.some(batch => batch.row_key === row.row_key && batch.quantity === row.quantity) : row.serial_numbers.length !== row.quantity)) ||
      result.data.reduce((sum, row) => sum + row.quantity, 0) !== expectedQuantity) throw new Error('退供试算响应不完整')
    const serials = result.data.flatMap(row => row.serial_numbers)
    if (serials.length !== serialDraft.value.size || new Set(serials).size !== serials.length ||
      [...serialDraft.value.values()].some(sn => !result.data.some(row => row.store_id === sn.store_id && row.serial_numbers.includes(sn.serial_number)))) throw new Error('退供SN试算响应不完整')
    quote.value = result
  } catch (error) {
    if (request.isLatest() && !quoteRequests.isCanceledError(error)) quoteFailed.value = true
  } finally { if (request.isLatest()) quoting.value = false }
}
const costText = (row: Batch) => row.purchase_cost === null ? '-' : `¥${formatAmount(row.purchase_cost)}`
const usageText = (row: Pick<Batch, 'usage_type'>) => row.usage_type === 'sale' ? '收费' : row.usage_type === 'gift' ? '赠送' : row.usage_type === 'unclassified' ? '历史用途待核对' : '-'
const trackingText = (row: Pick<Batch, 'serial_tracking'>) => row.serial_tracking === 1 ? 'SN逐件' : row.serial_tracking === 0 ? '普通数量' : '-'
const load = async () => {
  if (!props.visible || !canViewReturnContext.value || !Number.isSafeInteger(props.purchaseId) || props.purchaseId < 1) return
  invalidateQuote()
  const request = requests.nextRequest()
  loading.value = true; failed.value = false
  try {
    const response = await getAccessoryPurchaseReturnContext(props.purchaseId, page.value, pageSize, request.signal,
      stockVisible('serial_number') ? { page: serialPage.value, search: serialSearch.value } : undefined)
    if (!request.isLatest()) return
    const result = response.data
    if (!response.success || !result || result.purchase?.id !== props.purchaseId || typeof result.purchase.has_snapshot !== 'boolean' ||
      !['verified', 'untracked'].includes(result.ledger_status) || !result.pagination ||
      result.pagination.page !== page.value || result.pagination.page_size !== pageSize ||
      !Number.isSafeInteger(result.pagination.total) || result.pagination.total < 0 || !Array.isArray(result.data) ||
      result.data.length > pageSize || new Set(result.data.map(row => row?.row_key)).size !== result.data.length ||
      !['paid', 'unpaid'].includes(result.purchase.payment_status ?? '') ||
      !Number.isSafeInteger(Number(result.purchase.quantity)) || Number(result.purchase.quantity) < 1 ||
      [result.purchase.purchase_cost, result.purchase.total_amount, result.purchase.paid_amount, result.purchase.unpaid_amount]
        .some(value => value === null || value === undefined || !isMoneyInput(value) || Number(value) < 0) ||
      (result.ledger_status === 'verified' ? !Number.isSafeInteger(result.current_quantity) || Number(result.current_quantity) < 0 : result.current_quantity !== null || result.data.length > 0) ||
      result.data.some(row => !row || typeof row.row_key !== 'string' || !row.row_key || !Number.isSafeInteger(row.store_id) || row.store_id < 1 ||
        !['number', 'string'].includes(typeof row.quantity) || !Number.isSafeInteger(Number(row.quantity)) || Number(row.quantity) < 1 ||
        ![null, 'sale', 'gift', 'unclassified'].includes(row.usage_type) || ![null, 0, 1].includes(row.serial_tracking) ||
        (row.purchase_cost !== null && (!isMoneyInput(row.purchase_cost) || Number(row.purchase_cost) < 0)) ||
        (row.store_name !== null && typeof row.store_name !== 'string'))) throw new Error('采购核对响应不完整')
    const lastPage = Math.max(1, Math.ceil(result.pagination.total / pageSize))
    const serials = result.serials
    if (result.ledger_status === 'untracked' || !stockVisible('serial_number')) {
      if (serials !== null) throw new Error('采购SN权限或来源响应不完整')
    } else if (!serials || !Array.isArray(serials.data) || !serials.pagination ||
      serials.pagination.page !== serialPage.value || serials.pagination.page_size !== pageSize ||
      !Number.isSafeInteger(serials.pagination.total) || serials.pagination.total < 0 || serials.pagination.total > Number(result.current_quantity) ||
      serials.data.length > pageSize || new Set(serials.data.map(row => row?.id)).size !== serials.data.length ||
      new Set(serials.data.map(row => row?.serial_number)).size !== serials.data.length ||
      serials.data.some(row => !row || !Number.isSafeInteger(row.id) || row.id < 1 ||
        typeof row.serial_number !== 'string' || !row.serial_number.trim() || row.serial_number.length > 100 ||
        !Number.isSafeInteger(row.store_id) || Number(row.store_id) < 1 || (row.store_name !== null && typeof row.store_name !== 'string'))) {
      throw new Error('采购SN响应不完整')
    }
    const lastSerialPage = Math.max(1, Math.ceil((serials?.pagination.total ?? 0) / pageSize))
    if (page.value > lastPage || serialPage.value > lastSerialPage) {
      page.value = Math.min(page.value, lastPage); serialPage.value = Math.min(serialPage.value, lastSerialPage)
      await load(); return
    }
    if (result.data.length !== Math.min(pageSize, result.pagination.total - (page.value - 1) * pageSize)) throw new Error('采购核对分页不完整')
    if (serials && serials.data.length !== Math.min(pageSize, serials.pagination.total - (serialPage.value - 1) * pageSize)) throw new Error('采购SN分页不完整')
    context.value = result
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) { context.value = null; failed.value = true }
  } finally { if (request.isLatest()) loading.value = false }
}
const changePage = (value: number) => { page.value = value; void load() }
const changeSerialPage = (value: number) => { serialPage.value = value; void load() }
const searchSerials = () => { serialSearch.value = serialKeyword.value.trim(); serialPage.value = 1; void load() }
const refresh = () => { clearSelection(); void load() }
watch(canQuoteReturn, value => { if (!value) clearSelection() })
watch(() => [props.visible, props.purchaseId, canViewReturnContext.value, fieldPermissions.permissions.value, stockVisible('serial_number')], () => {
  clearSelection()
  paidSettlementMode.value = 'supplier_refund'
  requests.cancelLatest(); context.value = null; loading.value = false; failed.value = false; page.value = 1
  serialPage.value = 1; serialKeyword.value = ''; serialSearch.value = ''
  if (props.visible && canViewReturnContext.value) void load()
  else if (props.visible) emit('update:visible', false)
}, { immediate: true, deep: true })

const { isMobile } = useMobile()
const { detailRow, detailVisible, doubleTapOptions: detailTapOptions, handleRowDoubleClick: detailDoubleClick } = useMobileTableDetail<Batch>({
  enabled: () => isMobile.value && props.visible && canViewReturnContext.value, rows: () => context.value?.data ?? [], getKey: row => row.row_key
})
const detailFields = computed<RecordDetailField[]>(() => {
  const row = detailRow.value
  return row ? [
    { key: 'store_name', label: '当前门店', value: row.store_name, visible: true },
    { key: 'quantity', label: '剩余数量', value: row.quantity, visible: true },
    { key: 'purchase_cost', label: '原采购单价', value: costText(row), visible: stockVisible('purchase_cost') },
    { key: 'usage_type', label: '库存用途', value: usageText(row), visible: stockVisible('usage_type') },
    { key: 'serial_tracking', label: '管理方式', value: trackingText(row), visible: stockVisible('serial_tracking') }
  ] : []
})
const { detailRow: serialDetailRow, detailVisible: serialDetailVisible, doubleTapOptions: serialDetailTapOptions, handleRowDoubleClick: serialDetailDoubleClick } = useMobileTableDetail<Serial>({
  enabled: () => isMobile.value && props.visible && canViewReturnContext.value && stockVisible('serial_number'),
  rows: () => context.value?.serials?.data ?? [], getKey: row => row.id
})
const serialDetailFields = computed<RecordDetailField[]>(() => serialDetailRow.value ? [
  { key: 'serial_number', label: 'SN序列号', value: serialDetailRow.value.serial_number, visible: stockVisible('serial_number'), wide: true },
  { key: 'store_name', label: '当前门店', value: serialDetailRow.value.store_name, visible: true }
] : [])
</script>
