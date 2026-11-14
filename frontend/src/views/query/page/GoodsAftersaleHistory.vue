<template>
  <section v-if="allowed">
    <h3>商品售后记录</h3>
    <p>仅展示原销售门店与办理门店均在授权范围内的记录，退款、补款按本商品归属展示。</p>
    <p v-if="canViewMoney && hasExchange">
      换货原件抵付用于新件结算，实际资金往来仅为退款或补款。
    </p>
    <p v-if="canViewMoney && rows.some(row => row.settlement_offset_amount)">
      同单抵扣调整：正数表示本商品应退金额用于抵扣同单款项，负数表示由同单退款抵扣，不是另一笔资金往来。
    </p>
    <DataEmptyState
      v-if="failed"
      state="error"
      title="售后记录读取失败"
      :description="failureMessage"
      size="compact"
      action-text="重试"
      @action="retry"
    />
    <template v-else>
      <div class="table-wrapper">
        <el-table
          v-tf-loading="{ active: loading, text: '正在读取商品售后记录...' }"
          :data="rows"
          class="data-table"
          row-key="id"
        >
          <el-table-column
            v-if="visible('sequence')"
            label="序号"
            :width="$getNumberColumnWidth(rows.map((_, index) => (page - 1) * pageSize + index + 1), 72)"
            align="center"
          >
            <template #default="{ $index }">
              <span class="table-number-badge">{{ (page - 1) * pageSize + $index + 1 }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-for="column in columns"
            :key="column.replacementKey || column.key"
            :label="column.label"
            :min-width="column.width"
            align="center"
          >
            <template #default="{ row }">
              {{ display(column.replacementKey ? row.replacement?.[column.replacementKey] : row[column.key], column.format) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewMoney"
            label="退款／补款方式"
            min-width="150"
            align="center"
          >
            <template #default="{ row }">
              <PaymentMethodText
                :value="row.settlement_method"
                :channel="row.settlement_channel"
              />
            </template>
          </el-table-column>
          <template #empty>
            <TableLoadingRow
              v-if="loading"
              mode="block"
              text="正在读取商品售后记录..."
            />
            <DataEmptyState
              v-else
              description="当前授权范围内暂无商品售后记录"
              size="compact"
            />
          </template>
        </el-table>
      </div>
      <Pagination
        :current="page"
        :page-size="pageSize"
        :total="total"
        :disabled="loading"
        :show-page-sizes="false"
        @change="changePage"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getGoodsAftersales } from '@/api/query-goods'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { PaymentMethodText } from '@/components/payment'
import { canViewAccessoryField as visible, type AccessoryFieldName } from '@/components/accessory-field-permissions'
import { getRequestErrorMessage } from '@/utils/api-response'
import { isGoodsAftersalesPage } from '@/utils/query-goods'
import { formatAmount, formatDateTime } from '@/utils/format'
import { TIME_FORMATS } from '@/utils/time'
import type { GoodsAftersaleRecord, GoodsExchangeReplacement } from '@/types/accessory'

const props = defineProps<{ saleId: number }>()
const { canView: canQuery } = usePagePermissions('query')
const { canView: canGoods } = usePagePermissions('accessories')
const allowed = computed(() => canQuery.value && canGoods.value)
const canViewMoney = computed(() => visible('usage_type') && visible('total_quantity') && visible('unit_price') && visible('total_price'))
const requests = useLatestRequest()
const rows = ref<GoodsAftersaleRecord[]>([])
const page = ref(1), pageSize = 20, total = ref(0)
const loading = ref(false), failed = ref(false), failureMessage = ref('')
const hasExchange = computed(() => rows.value.some(row => row.operation_type === 'goods_exchange'))
type CellFormat = 'money' | 'time' | 'serials' | 'operation'
interface Column { key: keyof GoodsAftersaleRecord; replacementKey?: keyof GoodsExchangeReplacement; label: string; width: number; field?: AccessoryFieldName; format?: CellFormat; financial?: boolean; exchangeOnly?: boolean }
const definitions: Column[] = [
  { key: 'operation_type', label: '售后类型', width: 130, format: 'operation' },
  { key: 'quantity', label: '退货数量', width: 100, field: 'total_quantity' },
  { key: 'gift_charge_quantity', label: '未退赠品扣款数量', width: 150, field: 'total_quantity' },
  { key: 'serial_numbers', label: '退回SN', width: 180, field: 'serial_number', format: 'serials' },
  { key: 'store_name', label: '办理门店', width: 120, field: 'distribution' },
  { key: 'operator_name', label: '办理人（当前姓名）', width: 150, field: 'operator_name' },
  { key: 'base_refund_amount', label: '原实付应退', width: 120, financial: true, format: 'money' },
  { key: 'points_recovery_amount', label: '已用积分优惠追回', width: 150, financial: true, format: 'money' },
  { key: 'points_compensation_amount', label: '已追回优惠补退', width: 140, financial: true, format: 'money' },
  { key: 'gift_charge_amount', label: '未退赠品扣款', width: 140, financial: true, format: 'money' },
  { key: 'replacement', replacementKey: 'name', label: '换入商品', width: 150, field: 'name', exchangeOnly: true },
  { key: 'replacement', replacementKey: 'order_no', label: '换入共同单号', width: 180, field: 'sequence', exchangeOnly: true },
  { key: 'replacement', replacementKey: 'sale_no', label: '换入销售单号', width: 180, field: 'sequence', exchangeOnly: true },
  { key: 'replacement', replacementKey: 'operator_name', label: '新商品销售员（原记录）', width: 180, field: 'operator_name', exchangeOnly: true },
  { key: 'replacement', replacementKey: 'serial_numbers', label: '换入SN', width: 180, field: 'serial_number', format: 'serials', exchangeOnly: true },
  { key: 'replacement_amount', label: '新件净应付', width: 120, financial: true, format: 'money', exchangeOnly: true },
  { key: 'exchange_credit_amount', label: '原件抵付新件', width: 130, financial: true, format: 'money', exchangeOnly: true },
  { key: 'settlement_offset_amount', label: '同单抵扣调整', width: 140, financial: true, format: 'money' },
  { key: 'refund_amount', label: '本商品归属退款', width: 140, financial: true, format: 'money' },
  { key: 'collection_amount', label: '本商品归属补款', width: 140, financial: true, format: 'money' },
  { key: 'points_delta', label: '账户积分变化', width: 120, financial: true },
  { key: 'points_award_returned', label: '撤销原奖励积分', width: 140, financial: true },
  { key: 'points_redemption_returned', label: '核销原抵扣积分', width: 140, financial: true },
  { key: 'return_reason', label: '售后原因', width: 120, field: 'remarks' },
  { key: 'remarks', label: '备注', width: 160, field: 'remarks' },
  { key: 'business_time', label: '售后业务时间', width: 170, field: 'created_at', format: 'time' },
  { key: 'created_at', label: '记录时间', width: 170, field: 'created_at', format: 'time' }
]
const columns = computed(() => definitions.filter(column => {
  if (column.exchangeOnly && !hasExchange.value) return false
  if (['gift_charge_quantity', 'gift_charge_amount'].includes(column.key) && !visible('usage_type')) return false
  if (column.key === 'quantity' && !visible('usage_type')) return false
  return column.financial ? canViewMoney.value : !column.field || visible(column.field)
}))
const display = (value: unknown, format?: CellFormat) => {
  if (value === null || value === undefined || value === '') return '-'
  if (format === 'operation') return { goods_return: '商品退货', phone_return: '手机联合退货', goods_exchange: '商品换货' }[String(value)] || '-'
  if (format === 'money') return `¥${formatAmount(String(value))}`
  if (format === 'time') return formatDateTime(String(value), TIME_FORMATS.DATETIME_MINUTE)
  if (format === 'serials') return Array.isArray(value) && value.length ? value.join('、') : '-'
  return String(value)
}
const load = async () => {
  if (!allowed.value) return
  const request = requests.nextRequest()
  loading.value = true
  failed.value = false
  try {
    const response = await getGoodsAftersales(props.saleId, page.value, pageSize, request.signal)
    if (!request.isLatest()) return
    if (!isGoodsAftersalesPage(response.data, page.value, pageSize)) throw new Error('售后分页或资金凭据不完整，请重试或联系管理员核对')
    rows.value = response.data.data
    total.value = response.data.pagination.total
  } catch (error) {
    if (!request.isLatest() || requests.isCanceledError(error)) return
    failed.value = true
    failureMessage.value = getRequestErrorMessage(error, '请检查网络后重试')
  } finally { if (request.isLatest()) loading.value = false }
}
const retry = () => { void load() }
const changePage = (value: number) => { page.value = value; void load() }
watch([() => props.saleId, allowed], () => {
  requests.cancelLatest()
  rows.value = []; total.value = 0; page.value = 1; loading.value = false; failed.value = false; failureMessage.value = ''
  if (allowed.value) void load()
}, { immediate: true })
</script>
