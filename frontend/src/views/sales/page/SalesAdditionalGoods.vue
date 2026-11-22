<template>
  <div class="checkout-additional-goods">
    <div
      v-if="standalone"
      class="cashier-search tf-form-row tf-form-row--three"
    >
      <slot name="store" />
      <el-form-item label="商品检索">
        <div class="tf-dialog-toolbar cashier-search-controls w-full">
          <el-input
            ref="catalogInputRef"
            v-model="catalogKeyword"
            class="flex-1"
            clearable
            :maxlength="100"
            :disabled="disabled || !storeId"
            placeholder="输入商品名称、条形码或SN检索"
            aria-label="收银商品检索"
            @keydown.enter.prevent="catalogSearchEnter"
            @clear="search('')"
          />
          <el-button
            :disabled="disabled || !storeId"
            @click="search(catalogKeyword)"
          >
            检索
          </el-button>
          <el-button
            v-if="canScan"
            :disabled="disabled || !storeId"
            @click="scannerVisible = true"
          >
            扫码
          </el-button>
        </div>
      </el-form-item>
    </div>
    <InlineLoading
      v-if="scanPending"
      :text="`正在识别商品，待处理 ${scanPending} 件...`"
    />
    <p
      v-else-if="scanMessage"
      class="text-secondary"
      role="status"
    >
      {{ scanMessage }}
    </p>
    <div :class="{ 'cashier-workspace': standalone }">
      <section
        v-if="standalone"
        class="cashier-catalog"
        aria-label="商品检索"
      >
        <p class="text-secondary">
          {{ storeId ? `本店可售商品 · ${total} 项` : '请先选择销售门店' }}
        </p>
        <div
          v-tf-loading="{ active: loading, text: '正在检索本店商品...' }"
          class="cashier-products tf-scrollbar-hidden"
          @scroll.passive="handleCatalogScroll"
        >
          <SectionLoading
            v-if="loading && !options.length"
            text="正在检索本店商品..."
          />
          <DataEmptyState
            v-else-if="!options.length && !failed"
            :description="storeId ? '暂无匹配商品，请调整关键词或扫码' : '选择销售门店后检索商品'"
          />
          <div
            v-for="option in options"
            :key="keyOf(option)"
            class="admin-panel cashier-product"
            data-density="compact"
          >
            <el-button
              type="primary"
              link
              :disabled="disabled"
              @click="selectedKey = keyOf(option)"
            >
              {{ option.name }}
            </el-button>
            <div class="cashier-product__tags">
              <el-tag
                v-for="tag in productTags(option).filter(tag => tag.field !== 'product_model')"
                :key="tag.field"
                :type="tag.type"
                :title="`${tag.label}：${tag.value}`"
                class="tf-tag--wrap"
                effect="light"
              >
                {{ tag.value }}
              </el-tag>
              <span
                v-if="visible('product_model') && option.product_model || visible('barcode')"
                class="cashier-product__tags"
              >
                <el-tag
                  v-for="tag in productTags(option).filter(tag => tag.field === 'product_model')"
                  :key="tag.field"
                  :type="tag.type"
                  :title="`${tag.label}：${tag.value}`"
                  class="tf-tag--wrap"
                  effect="light"
                >
                  {{ tag.value }}
                </el-tag>
                <el-tag
                  v-if="visible('barcode')"
                  type="info"
                  class="tf-tag--wrap"
                  effect="light"
                  :title="`条形码：${option.barcode || '未设置'}`"
                >
                  {{ option.barcode || '无条形码' }}
                </el-tag>
              </span>
            </div>
            <div class="tf-dialog-toolbar">
              <el-tag
                v-if="visible('sale_price')"
                type="warning"
                class="tf-tag--wrap"
                effect="light"
              >
                {{ option.sale_price === null ? '未授权' : `¥${formatAmount(option.sale_price)}` }}
              </el-tag>
              <el-tag
                type="success"
                class="tf-tag--wrap"
                effect="light"
              >
                可售 {{ availableQuantity(option) }}<template v-if="visible('unit')">
                  {{ option.unit }}
                </template>
              </el-tag>
              <el-button
                v-permission="{ permission: ['accessories:sell', 'accessories:gift', 'query:goods-sell', 'query:goods-gift'] }"
                class="tf-button--cart"
                :disabled="disabled || availableQuantity(option) <= 0"
                :title="`加入${option.name}`"
                :aria-label="`加入${option.name}`"
                link
                @click="addOption(option, saleType, null)"
              >
                <el-icon>
                  <i
                    class="fas fa-shopping-cart"
                    aria-hidden="true"
                  />
                </el-icon>
              </el-button>
            </div>
          </div>
        </div>
        <div class="tf-dialog-toolbar">
          <el-button
            v-if="failed"
            :disabled="disabled"
            @click="load()"
          >
            重新检索
          </el-button>
          <el-button
            v-else-if="options.length < total"
            :loading="loading"
            :disabled="disabled"
            @click="loadMore"
          >
            加载更多
          </el-button>
        </div>
      </section>
      <section
        :class="{ 'cashier-order': standalone }"
        aria-label="商品与结算清单"
      >
        <template v-if="standalone">
          <div class="cashier-order__heading">
            <strong>当前订单 <span class="text-secondary">· {{ itemCount }} 件</span></strong>
            <el-button
              :disabled="disabled || !modelValue.length"
              @click="clearCart"
            >
              清空
            </el-button>
          </div>
          <details
            v-if="selectedOption"
            class="cashier-selection"
            open
          >
            <summary>商品资料 · {{ selectedOption.name }}</summary>
            <div class="cashier-selection__layout">
              <div class="cashier-selection__identity">
                <strong>{{ selectedOption.name }}</strong>
                <RecordDescriptions
                  :column="2"
                  compact
                >
                  <el-descriptions-item
                    v-if="visible('product_model')"
                    label="配件型号"
                    :span="2"
                  >
                    {{ selectedOption.product_model || '-' }}
                  </el-descriptions-item>
                </RecordDescriptions>
              </div>
              <RecordDescriptions
                :column="2"
                compact
              >
                <el-descriptions-item v-if="visible('category')">
                  {{ selectedOption.category || '-' }}
                </el-descriptions-item>
                <el-descriptions-item v-if="visible('brand_name')">
                  {{ selectedOption.brand_name || '-' }}
                </el-descriptions-item>
                <el-descriptions-item v-if="visible('color_name')">
                  {{ selectedOption.color_name || '-' }}
                </el-descriptions-item>
                <el-descriptions-item v-if="visible('unit')">
                  {{ selectedOption.unit || '-' }}
                </el-descriptions-item>
              </RecordDescriptions>
            </div>
            <div class="cashier-selection__layout">
              <RecordDescriptions
                v-if="visible('barcode') || visible('serial_number') && selectedOption.serial_number"
                :column="2"
                compact
              >
                <el-descriptions-item
                  v-if="visible('barcode')"
                  label="条形码"
                  :span="2"
                >
                  {{ selectedOption.barcode || '-' }}
                </el-descriptions-item>
                <el-descriptions-item
                  v-if="visible('serial_number') && selectedOption.serial_number"
                  label="SN"
                  :span="2"
                >
                  {{ selectedOption.serial_number }}
                </el-descriptions-item>
              </RecordDescriptions>
              <RecordDescriptions
                :column="2"
                compact
              >
                <el-descriptions-item
                  v-if="visible('sale_price')"
                  label="零售价"
                >
                  <el-tag
                    type="warning"
                    effect="light"
                    class="tf-tag--wrap"
                  >
                    {{ selectedOption.sale_price === null ? '-' : `¥${formatAmount(selectedOption.sale_price)}` }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="可售数量">
                  <el-tag
                    :type="availableQuantity(selectedOption) > 0 ? 'success' : 'info'"
                    effect="light"
                    class="tf-tag--wrap"
                  >
                    {{ availableQuantity(selectedOption) }}
                  </el-tag>
                </el-descriptions-item>
              </RecordDescriptions>
            </div>
          </details>
        </template>
        <el-row
          :gutter="16"
          :align="standalone ? 'middle' : 'top'"
        >
          <el-col
            v-if="!standalone"
            :xs="18"
            :sm="12"
          >
            <el-form-item label="商品检索">
              <el-select
                ref="goodsSelectRef"
                v-model="selectedKey"
                filterable
                remote
                clearable
                :loading="loading"
                :disabled="disabled || !storeId"
                :remote-method="search"
                placeholder="输入商品名称、条形码或SN检索"
                aria-label="商品检索"
                @visible-change="openOptions"
                @popup-scroll="handleGoodsScroll"
              >
                <el-option
                  v-for="option in options"
                  :key="keyOf(option)"
                  :value="keyOf(option)"
                  :label="labelOf(option)"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col
            v-if="!standalone && canScan"
            :xs="6"
            :sm="3"
          >
            <el-form-item label="扫码">
              <el-button
                :disabled="disabled || !storeId"
                @click="scannerVisible = true"
              >
                扫码
              </el-button>
            </el-form-item>
          </el-col>
          <el-col
            :xs="standalone ? 16 : 12"
            :sm="standalone ? 16 : 5"
          >
            <el-form-item
              label="出库方式"
              :class="{ 'tf-form-field--inline': standalone }"
            >
              <el-select
                v-model="saleType"
                :disabled="disabled"
              >
                <el-option
                  v-if="canCreate"
                  label="购买"
                  value="sale"
                />
                <el-option
                  v-if="canGift"
                  label="赠送"
                  value="gift"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col
            v-if="!standalone || selectedOption"
            :xs="standalone ? 8 : 12"
            :sm="standalone ? 8 : 4"
          >
            <el-form-item
              :label="standalone ? undefined : '操作'"
              :class="{ 'tf-form-field--inline': standalone }"
            >
              <el-button
                v-permission="{ permission: ['accessories:sell', 'accessories:gift', 'query:goods-sell', 'query:goods-gift'] }"
                class="tf-button--save"
                type="primary"
                :disabled="disabled || !selectedOption || availableQuantity(selectedOption) <= 0 || loading"
                @click="confirm"
              >
                {{ standalone ? '加入清单' : '确认' }}
              </el-button>
            </el-form-item>
          </el-col>
          <el-col
            v-if="phones.length > 1"
            :xs="24"
            :sm="12"
          >
            <el-form-item
              label="关联手机"
              required
            >
              <el-select
                v-model="linkedPhoneId"
                filterable
                :disabled="disabled"
                placeholder="选择商品关联的手机"
              >
                <el-option
                  v-for="phone in phones"
                  :key="phone.phone_id"
                  :value="phone.phone_id"
                  :label="phone.label"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-alert
          v-if="failed"
          title="商品读取失败，请重新检索"
          type="error"
          :closable="false"
          class="mb-4"
        />
        <div
          v-if="standalone"
          class="cashier-cart tf-scrollbar-hidden"
        >
          <DataEmptyState
            v-if="!modelValue.length"
            description="点击商品加入订单，或扫描条形码 / SN"
          />
          <article
            v-for="row in modelValue"
            :key="row.key"
            class="cashier-cart-line"
          >
            <div class="cashier-cart-line__heading">
              <div class="cashier-cart-line__identity">
                <strong>{{ row.option?.name }}</strong>
                <el-tag :type="row.sale_type === 'gift' ? 'warning' : 'success'">
                  {{ row.sale_type === 'gift' ? '赠送' : '销售' }}
                </el-tag>
                <div class="cashier-product__tags">
                  <el-tag
                    v-for="tag in productTags(row.option, row.serial_numbers.join('、'))"
                    :key="tag.field"
                    :type="tag.type"
                    :title="`${tag.label}：${tag.value}`"
                    class="tf-tag--wrap"
                    effect="light"
                  >
                    {{ tag.value }}
                  </el-tag>
                </div>
              </div>
              <el-button
                class="tf-button--delete"
                type="danger"
                :disabled="disabled"
                :aria-label="`删除${row.option?.name || '商品'}`"
                @click="remove(row.key)"
              >
                删除
              </el-button>
            </div>
            <div class="cashier-cart-line__fields">
              <el-form-item
                label="数量"
                class="tf-form-field--inline cashier-cart-line__quantity"
              >
                <el-input-number
                  class="form-control"
                  :aria-label="`${row.option?.name || '商品'}数量`"
                  :model-value="row.quantity || undefined"
                  :min="1"
                  :max="999999"
                  :precision="0"
                  :controls="false"
                  :disabled="disabled || row.serial_mode"
                  @update:model-value="updateQuantity(row.key, $event)"
                />
              </el-form-item>
              <el-form-item
                label="销售价"
                class="tf-form-field--inline cashier-cart-line__unit-price"
              >
                <AmountInput
                  class="form-control"
                  :aria-label="`${row.option?.name || '商品'}价格`"
                  :model-value="row.unit_price"
                  :min="0"
                  :max="99999999.99"
                  :disabled="disabled || row.sale_type === 'gift'"
                  @update:model-value="updatePrice(row.key, $event)"
                />
              </el-form-item>
              <p
                v-if="visible('total_price')"
                class="cashier-cart-line__subtotal"
                title="积分抵扣前金额"
              >
                合计 <strong>{{ lineSubtotal(row) === null ? '-' : `${formatAmount(lineSubtotal(row))} 元` }}</strong>
              </p>
            </div>
          </article>
        </div>
        <div
          v-if="standalone"
          class="cashier-order__total"
        >
          <div class="cashier-order__heading">
            <span>合计 · {{ itemCount }} 件</span>
            <strong
              v-if="visible('total_price')"
              class="cashier-order__amount"
            >{{ cartAmount === null ? '请完善价格与数量' : `¥${formatAmount(cartAmount)}` }}</strong>
          </div>
          <slot name="checkout" />
        </div>
        <el-table
          v-else
          :data="modelValue"
          row-key="key"
          class="admin-data-table mb-4"
        >
          <el-table-column
            label="商品名称"
            :min-width="nameWidth"
          >
            <template #default="{ row }">
              <div
                class="additional-goods-product"
                :title="[row.option?.name, productInfo(row), phones.length > 1 ? phones.find(phone => phone.phone_id === row.linked_phone_id)?.label : ''].filter(Boolean).join(' · ')"
              >
                <strong class="additional-goods-product__name">{{ row.option?.name }}</strong>
                <span class="text-secondary additional-goods-product__detail">{{ productInfo(row) }}</span>
                <span
                  v-if="phones.length > 1"
                  class="text-secondary additional-goods-product__detail"
                >
                  {{ phones.find(phone => phone.phone_id === row.linked_phone_id)?.label }}
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            label="方式"
            :width="typeWidth"
          >
            <template #default="{ row }">
              {{ row.sale_type === 'gift' ? '赠送' : '购买' }}
            </template>
          </el-table-column>
          <el-table-column
            label="数量"
            :width="quantityWidth"
          >
            <template #default="{ row }">
              <el-input-number
                class="form-control"
                :aria-label="`${row.option?.name || '商品'}数量`"
                :model-value="row.quantity || undefined"
                :min="1"
                :max="999999"
                :precision="0"
                :controls="false"
                :disabled="disabled || row.serial_mode"
                @update:model-value="updateQuantity(row.key, $event)"
              />
            </template>
          </el-table-column>
          <el-table-column
            label="价格"
            :width="priceWidth"
            align="right"
          >
            <template #default="{ row }">
              <AmountInput
                class="form-control"
                :aria-label="`${row.option?.name || '商品'}价格`"
                :model-value="row.unit_price"
                :min="0"
                :max="99999999.99"
                :disabled="disabled || row.sale_type === 'gift'"
                @update:model-value="updatePrice(row.key, $event)"
              />
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            :width="getActionColumnMinWidth(1, { buttonWidth: 32 })"
            class-name="actions-column"
          >
            <template #default="{ row }">
              <div class="table-actions">
                <el-button
                  type="danger"
                  class="table-action--delete"
                  circle
                  :icon="Minus"
                  :title="`删除${row.option?.name || '商品'}`"
                  :aria-label="`删除${row.option?.name || '商品'}`"
                  :disabled="disabled"
                  @click.stop="remove(row.key)"
                />
              </div>
            </template>
          </el-table-column>
          <template #empty>
            <DataEmptyState description="检索商品，确认后加入清单" />
          </template>
        </el-table>
      </section>
    </div>
    <OptimizedScanner
      v-if="scannerVisible"
      v-model:visible="scannerVisible"
      scan-type="serial"
      serial-profile="product"
      @success="queueScan"
      @manual="focusScan"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { InputInstance, TagProps } from 'element-plus'
import { Minus } from '@element-plus/icons-vue'
import { getCheckoutGoods } from '@/api/sales-checkout'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useSelectLoadMore } from '@/composables/useSelectLoadMore'
import { useGoodsPermissions } from '@/composables/useGoodsPermissions'
import { useNotification } from '@/composables/useNotification'
import { canViewAccessoryField as canViewStockField, canViewQueryGoodsField, type AccessoryFieldName } from '@/components/accessory-field-permissions'
import { formatAmount } from '@/utils/format'
import { createCheckoutKey } from '@/utils/sales-checkout'
import { isValidAccessorySerial, isValidProductCode, normalizeAccessorySerial } from '@/utils/accessory-serial'
import { getActionColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import type { CheckoutGoodsDraft, CheckoutGoodsOption, CheckoutPhone } from '@/types/sales-checkout'

const OptimizedScanner = defineAsyncComponent(() => import('@/components/OptimizedScanner.vue'))
const props = defineProps<{ fieldSource?: 'accessories' | 'query'; modelValue: CheckoutGoodsDraft[]; storeId: number | null; phones: CheckoutPhone[]; disabled: boolean; standalone?: boolean }>()
const standalone = computed(() => props.standalone === true)
const nameWidth = computed(() => getTextColumnMinWidth(['商品名称', ...props.modelValue.map(row => row.option?.name)], { minWidth: 144, maxWidth: 320 }))
const typeWidth = getTextColumnMinWidth(['方式', '购买', '赠送'], { minWidth: 0 })
const priceWidth = computed(() => getTextColumnMinWidth(['价格', ...props.modelValue.map(row => row.unit_price)], { minWidth: 120 }))
const lineSubtotal = (row: CheckoutGoodsDraft): number | null => {
  if (row.sale_type === 'gift') return 0
  const quantity = row.serial_mode ? row.serial_numbers.length : row.quantity
  if (row.unit_price === null || row.unit_price === undefined || !Number.isFinite(row.unit_price) || !Number.isSafeInteger(quantity) || quantity <= 0) return null
  return Math.round(row.unit_price * 100) * quantity / 100
}
const itemCount = computed(() => props.modelValue.reduce((sum, row) => sum + (row.serial_mode ? row.serial_numbers.length : row.quantity || 0), 0))
const cartAmount = computed(() => {
  const amounts = props.modelValue.map(lineSubtotal)
  return amounts.some(value => value === null) ? null : amounts.reduce<number>((sum, value) => sum + Math.round(Number(value) * 100), 0) / 100
})
const clearCart = () => { if (!props.disabled) emit('update:modelValue', []) }
const quantityWidth = getTextColumnMinWidth(['数量'], { minWidth: 96 })
const effectiveFieldSource = computed(() => props.fieldSource || source.value)
const visible = (field: AccessoryFieldName) => effectiveFieldSource.value === 'query' ? canViewQueryGoodsField(field) : canViewStockField(field)
const emit = defineEmits<{ 'update:modelValue': [rows: CheckoutGoodsDraft[]]; busy: [value: boolean] }>()
const { canCreate, hasPermission, source } = useGoodsPermissions(props.fieldSource)
const canGift = computed(() => hasPermission('gift'))
const notices = useNotification(), requests = useLatestRequest()
const saleType = ref<'sale' | 'gift'>(canCreate.value ? 'sale' : 'gift')
const selectedKey = ref<string>(), linkedPhoneId = ref<number | undefined>(props.phones.length === 1 ? props.phones[0].phone_id : undefined)
const options = ref<CheckoutGoodsOption[]>([]), loading = ref(false), failed = ref(false), total = ref(0)
let keyword = '', page = 0
const selectedOption = computed(() => options.value.find(row => keyOf(row) === selectedKey.value))
const reservedStock = computed(() => {
  const quantities = new Map<number, number>(), serials = new Set<string>()
  for (const row of props.modelValue) {
    if (row.serial_mode) {
      for (const serial of row.serial_numbers) serials.add(normalizeAccessorySerial(serial))
    } else if (row.option) {
      quantities.set(row.option.id, (quantities.get(row.option.id) || 0) + row.quantity)
    }
  }
  return { quantities, serials }
})
const availableQuantity = (option: CheckoutGoodsOption): number => {
  const reserved = option.serial_number
    ? Number(reservedStock.value.serials.has(normalizeAccessorySerial(option.serial_number)))
    : reservedStock.value.quantities.get(option.id) || 0
  return Math.max(0, Number(option.quantity) - reserved)
}
const productTags = (option: CheckoutGoodsOption | null | undefined, serial = option?.serial_number || '') => {
  const tags: Array<{ field: AccessoryFieldName; label: string; value: string | null | undefined; type: TagProps['type'] }> = [
    { field: 'category', label: '类型', value: option?.category, type: 'primary' },
    { field: 'brand_name', label: '品牌', value: option?.brand_name, type: 'success' },
    { field: 'product_model', label: '型号', value: option?.product_model, type: 'warning' },
    { field: 'serial_number', label: 'SN', value: serial, type: 'info' }
  ]
  return tags.filter(tag => visible(tag.field) && tag.value)
}
const catalogKeyword = ref(''), catalogInputRef = ref<InputInstance>()
const catalogSearchEnter = (event: Event | KeyboardEvent) => { if (!('isComposing' in event && event.isComposing)) void search(catalogKeyword.value) }
const keyOf = (option: CheckoutGoodsOption) => option.serial_number ? `sn:${option.serial_number}` : `goods:${option.id}`
const labelOf = (option: CheckoutGoodsOption) => [option.serial_number || (visible('product_model') ? option.product_model : ''), option.name,
  visible('brand_name') ? option.brand_name : '', visible('sale_price') && option.sale_price !== null ? `零售价 ¥${formatAmount(option.sale_price)}` : ''].filter(Boolean).join(' · ')
const productInfo = (row: CheckoutGoodsDraft) => [visible('brand_name') ? row.option?.brand_name : '', visible('product_model') ? row.option?.product_model : '', visible('serial_number') ? row.serial_numbers.join('、') : ''].filter(Boolean).join(' · ')
const reset = () => { requests.cancelLatest(); options.value = []; selectedKey.value = undefined; page = total.value = 0; loading.value = failed.value = false }
const load = async (append = false) => {
  if (!props.storeId || props.disabled || !hasPermission('view')) return
  const request = requests.nextRequest(), nextPage = append ? page + 1 : 1
  loading.value = true; failed.value = false
  try {
    const params = { store_id: props.storeId, search: keyword, page: nextPage, page_size: 20 }
    const [response, serialResponse] = await Promise.all([
      getCheckoutGoods({ ...params, source: effectiveFieldSource.value, search_mode: 'regular' }, request.signal),
      keyword && visible('serial_number') ? getCheckoutGoods({ ...params, source: effectiveFieldSource.value, search_mode: 'serial' }, request.signal) : null
    ])
    if (!request.isLatest()) return
    if (!response.success || !response.data || !Array.isArray(response.data.data) || !Number.isSafeInteger(response.data.pagination?.total)) throw new Error('候选资料不完整')
    if (serialResponse && (!serialResponse.success || !serialResponse.data || !Array.isArray(serialResponse.data.data) || !Number.isSafeInteger(serialResponse.data.pagination?.total))) throw new Error('SN候选资料不完整')
    const rows = [...response.data.data, ...(serialResponse?.data?.data || [])]
    options.value = [...new Map([...(append ? options.value : []), ...rows].map(row => [keyOf(row), row])).values()]
    total.value = response.data.pagination.total + (serialResponse?.data?.pagination.total || 0); page = nextPage
  } catch { if (request.isLatest()) failed.value = true }
  finally { if (request.isLatest()) loading.value = false }
}
const search = async (value: string) => { reset(); keyword = value.trim(); catalogKeyword.value = keyword; await load() }
const openOptions = (open: boolean) => { if (open && !loading.value && (!page || failed.value)) void load() }
const loadMore = () => { if (!loading.value && !failed.value && options.value.length < total.value) void load(true) }
const handleCatalogScroll = (event: Event) => {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement) || loading.value || failed.value || options.value.length >= total.value) return
  if (target.scrollHeight - target.clientHeight - target.scrollTop <= 24) void loadMore()
}
const { selectRef: goodsSelectRef, onPopupScroll: handleGoodsScroll } = useSelectLoadMore(
  loadMore, () => loading.value || failed.value || options.value.length >= total.value
)
const confirm = () => { const option = selectedOption.value; if (option && addOption(option, saleType.value, linkedPhoneId.value ?? null) && !standalone.value) selectedKey.value = undefined }
const addOption = (option: CheckoutGoodsOption, type: 'sale' | 'gift', phoneId: number | null): boolean => {
  if (props.disabled || !hasPermission('view') || !hasPermission(type === 'gift' ? 'gift' : 'create')) return false
  if (type === 'gift' && (option.sale_price === null || !Number.isFinite(Number(option.sale_price)))) { notices.error('无法读取赠品零售价，请联系管理员'); return false }
  if (props.phones.length && (!phoneId || !props.phones.some(phone => phone.phone_id === phoneId))) { notices.error('请选择关联手机'); return false }
  const count = 1, serial = option.serial_number || null
  if (serial && (!visible('serial_number') || !isValidAccessorySerial(serial))) { notices.error('请选择有效在库SN'); return false }
  if (serial && reservedStock.value.serials.has(normalizeAccessorySerial(serial))) { notices.error('该SN已加入清单'); return false }
  if (availableQuantity(option) < count) { notices.error('商品数量超过当前门店可售库存'); return false }
  const existing = !serial
    ? props.modelValue.find(row => row.option?.id === option.id && !row.serial_mode && row.sale_type === type && row.linked_phone_id === phoneId)
    : undefined
  if (!existing && props.modelValue.length + props.phones.length >= 1000) { notices.error('本单商品数量已达上限'); return false }
  if (existing) {
    emit('update:modelValue', props.modelValue.map(row => row.key === existing.key ? { ...row, quantity: row.quantity + count } : row))
    return true
  }
  const row: CheckoutGoodsDraft = { key: createCheckoutKey(), option, quantity: count, unit_price: type === 'gift' ? 0 : option.sale_price === null ? null : Number(option.sale_price),
    sale_type: type, linked_phone_id: phoneId ?? null, serial_mode: Boolean(serial), serial_numbers: serial ? [serial] : [],
    gift_return_unit_price: type === 'gift' ? option.sale_price === null ? null : Number(option.sale_price) : null }
  emit('update:modelValue', [...props.modelValue, row])
  return true
}
const remove = (key: string) => { if (!props.disabled) emit('update:modelValue', props.modelValue.filter(row => row.key !== key)) }
const updatePrice = (key: string, value: number | null | undefined) => { if (!props.disabled) emit('update:modelValue', props.modelValue.map(row => row.key === key && row.sale_type !== 'gift' ? { ...row, unit_price: value } : row)) }

const updateQuantity = (key: string, value: number | null | undefined) => {
  const row = props.modelValue.find(item => item.key === key)
  if (props.disabled || !row || row.serial_mode) return
  const count = value ?? 0
  const used = props.modelValue.filter(item => item.key !== key && item.option?.id === row.option?.id && !item.serial_mode).reduce((sum, item) => sum + item.quantity, 0)
  if (count + used > Number(row.option?.quantity)) { notices.error('商品数量超过当前门店可售库存'); return }
  emit('update:modelValue', props.modelValue.map(item => item.key === key ? { ...item, quantity: count } : item))
}
const canScan = computed(() => visible('barcode') || visible('serial_number'))
const scannerVisible = ref(false)
const scanPending = ref(0), scanMessage = ref(''), scanRequests = useLatestRequest()
let scanGeneration = 0, scanChain = Promise.resolve()
const focusScan = () => {
  void nextTick(() => {
    if (standalone.value) {
      catalogInputRef.value?.focus()
      return
    }
    const select = Array.isArray(goodsSelectRef.value) ? goodsSelectRef.value[0] : goodsSelectRef.value
    select?.focus()
  })
}
const cancelScans = () => {
  scanGeneration += 1; scanRequests.cancelLatest(); scanChain = Promise.resolve()
  scanPending.value = 0; scanMessage.value = ''; scannerVisible.value = false
  emit('busy', false)
}
const queueScan = (value: string) => {
  if (props.disabled || !props.storeId || !hasPermission('view') || !canScan.value) return
  const code = value.trim(), type = saleType.value, phoneId = linkedPhoneId.value ?? null
  if (!isValidProductCode(code)) { notices.error('请输入有效的条形码或SN，最多100位'); return }
  if (!hasPermission(type === 'gift' ? 'gift' : 'create')) return
  if (props.phones.length && !props.phones.some(phone => phone.phone_id === phoneId)) { notices.error('请选择关联手机后扫码'); return }
  const storeId = props.storeId, generation = scanGeneration
  scanMessage.value = ''; scanPending.value += 1; emit('busy', true); focusScan()
  // 按扫码顺序处理，等待父级 v-model 更新后再累加下一件，避免快扫丢数量。
  scanChain = scanChain.then(async () => {
    if (generation !== scanGeneration) return
    const request = scanRequests.nextRequest()
    try {
      const params = { store_id: storeId, search: code, page: 1, page_size: 20, match_mode: 'exact' as const }
      const responses = await Promise.all([
        visible('barcode') ? getCheckoutGoods({ ...params, source: effectiveFieldSource.value, search_mode: 'regular' }, request.signal) : null,
        visible('serial_number') ? getCheckoutGoods({ ...params, source: effectiveFieldSource.value, search: normalizeAccessorySerial(code), search_mode: 'serial' }, request.signal) : null
      ])
      if (!request.isLatest() || generation !== scanGeneration || props.disabled || !hasPermission('view') || props.storeId !== storeId) return
      const candidates: CheckoutGoodsOption[] = []
      let count = 0
      for (const response of responses) {
        if (!response) continue
        if (!response.success || !response.data || !Array.isArray(response.data.data) || !Number.isSafeInteger(response.data.pagination?.total) || response.data.pagination.total < 0) throw new Error('商品识别资料不完整')
        count += response.data.pagination.total
        candidates.push(...response.data.data)
      }
      if (count === 0) { notices.error('未找到本店可售商品，请核对条形码或改扫商品SN'); return }
      if (count > 1) {
        scanMessage.value = '该编码对应多个商品，请在检索结果中选择实际品牌或SN'
        notices.info(scanMessage.value); await search(code); return
      }
      const option = candidates[0]
      if (!option) throw new Error('商品识别资料不完整')
      if (addOption(option, type, phoneId)) scanMessage.value = `已加入：${option.name}${option.serial_number ? ` · ${option.serial_number}` : ''}`
      await nextTick()
    } catch (error) {
      if (request.isLatest() && generation === scanGeneration && !scanRequests.isCanceledError(error)) notices.error('商品识别失败，请核对网络后重新扫码')
    } finally {
      if (generation === scanGeneration) { scanPending.value -= 1; emit('busy', scanPending.value > 0) }
    }
  })
}
watch(() => props.storeId, (storeId, previousStoreId) => {
  reset(); cancelScans()
  keyword = ''
  catalogKeyword.value = ''
  if (storeId !== previousStoreId && props.modelValue.length) emit('update:modelValue', [])
  if (standalone.value && storeId) void load()
})
watch(() => props.disabled, value => { if (value) { reset(); cancelScans() } else if (standalone.value && props.storeId) void load() })
watch(() => [visible('barcode'), visible('serial_number')], cancelScans)
watch(() => hasPermission('view'), value => { if (!value) { reset(); cancelScans() } })
if (standalone.value && props.storeId) void load()
onBeforeUnmount(cancelScans)
</script>
<style scoped>
.cashier-search-controls { gap: var(--tf-space-2); }
.cashier-workspace { display: grid; grid-template-columns: minmax(0, 5fr) minmax(400px, 3fr); gap: var(--tf-space-4); }
.cashier-catalog, .cashier-order { min-width: 0; }
.cashier-order { padding: var(--tf-space-4); border: 1px solid var(--tf-color-border-cool); border-radius: var(--tf-radius-card); background: var(--tf-color-surface-cool-alt); }
.cashier-order__heading, .cashier-cart-line__heading { display: flex; justify-content: space-between; align-items: center; gap: var(--tf-space-2); }
.cashier-order__heading { margin-bottom: var(--tf-space-3); }
.cashier-selection { margin-bottom: var(--tf-space-3); overflow-wrap: anywhere; }
.cashier-selection__layout { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: var(--tf-space-3); align-items: start; }
.cashier-selection__layout > * { min-width: 0; }
.cashier-selection__layout > :only-child { grid-column: 1 / -1; }
.cashier-selection__identity { display: grid; gap: var(--tf-space-1); }
.cashier-selection summary { cursor: pointer; color: var(--el-color-primary); margin-bottom: var(--tf-space-2); }
.cashier-cart { display: grid; gap: var(--tf-space-3); max-height: 48vh; overflow-y: auto; }
.cashier-cart-line { min-width: 0; padding: var(--tf-space-3); border: 1px solid var(--tf-color-border-cool); border-radius: var(--tf-radius-card); background: var(--tf-color-surface-blue); }
.cashier-cart-line__identity { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.cashier-cart-line__identity > strong { color: var(--el-color-primary); }
.cashier-cart-line__identity > .el-tag { margin-inline-start: var(--tf-space-2); }
.cashier-cart-line__identity .cashier-product__tags { margin-top: var(--tf-space-2); }
.cashier-cart-line__heading { align-items: flex-start; }
.cashier-cart-line__fields { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tf-space-2); margin-top: var(--tf-space-3); }
.cashier-cart-line__fields .el-form-item { min-width: 0; margin-bottom: 0; }
.cashier-cart-line__quantity { flex: 0 1 calc(var(--tf-space-8) * 2); }
.cashier-cart-line__unit-price { flex: 0 1 calc(var(--tf-space-8) * 2 + var(--tf-space-7)); }
.cashier-cart-line__subtotal { margin: 0; margin-inline-start: auto; overflow-wrap: anywhere; }
.cashier-order__total { margin-top: var(--tf-space-4); padding-top: var(--tf-space-4); border-top: 1px solid var(--tf-color-border-cool); }
.cashier-order__amount { font-size: var(--tf-font-section-title); color: var(--el-color-primary); }
.cashier-product__tags { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tf-space-1); min-width: 0; }
.cashier-product__tags > .el-tag { flex: 0 0 auto; }
.cashier-products { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: var(--tf-space-3); max-height: 55vh; overflow-y: auto; }
.cashier-products > :not(.cashier-product) { grid-column: 1 / -1; }
.cashier-product { display: grid; align-content: start; gap: var(--tf-space-2); border: 1px solid var(--tf-color-border-cool); border-radius: var(--tf-radius-card); background: var(--tf-color-surface-cool-alt); overflow-wrap: anywhere; }
.cashier-product :deep(.el-button > span) { white-space: normal; overflow-wrap: anywhere; }
.cashier-order :deep(.el-descriptions__content) { overflow-wrap: anywhere; }
.additional-goods-product { display: flex; align-items: center; gap: var(--tf-space-2); min-width: 0; overflow: hidden; white-space: nowrap; }
.additional-goods-product__name, .additional-goods-product__detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.additional-goods-product__name { flex: 0 1 auto; }
.additional-goods-product__detail { flex: 0 1 auto; }
@media (min-width: 1025px) {
  .cashier-search { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 3fr); }
}
@media (max-width: 1024px) {
  .cashier-workspace { grid-template-columns: minmax(0, 1fr); }
  .cashier-products { max-height: 35vh; }
}
</style>
