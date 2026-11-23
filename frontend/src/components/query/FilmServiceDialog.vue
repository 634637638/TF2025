<template>
  <MobileDialog
    :model-value="modelValue"
    title="客户贴膜"
    :show-default-footer="false"
    :close-on-click-modal="!(phoneId && canOfferService)"
    :before-close="beforeClose"
    destroy-on-close
    @update:model-value="updateVisible"
  >
    <el-alert
      v-if="!allowed || !customer"
      title="缺少贴膜权限或客户资料，请核对权限及客户关联后重试"
      type="warning"
      :closable="false"
    />
    <template v-else>
      <section class="tf-query-modal-section">
        <dl
          class="tf-record-details tf-record-details--inline"
          aria-label="客户及贴膜统计"
        >
          <div class="tf-record-details__field">
            <dt>姓名</dt>
            <dd>{{ customer.name }}</dd>
          </div>
          <div
            v-if="visible('customer_phone')"
            class="tf-record-details__field"
          >
            <dt>手机号</dt>
            <dd>
              <el-text
                type="primary"
                size="small"
              >
                {{ customer.phone }}
              </el-text>
            </dd>
          </div>
          <div
            v-if="phoneId"
            class="tf-record-details__field"
          >
            <dt>本机累计贴膜</dt>
            <dd>
              <el-text
                type="primary"
                size="small"
              >
                <strong>{{ context?.device_service_count ?? '-' }} 次</strong><span v-if="visible('total_quantity')"> · {{ context?.device_film_quantity ?? '-' }} 张</span>
              </el-text>
            </dd>
          </div>
          <div
            class="tf-record-details__field"
            :class="{ 'tf-record-details__field--wide': !phoneId }"
          >
            <dt>累计总贴膜</dt>
            <dd>
              <el-text
                type="success"
                size="small"
              >
                <strong>{{ context?.service_count ?? '-' }} 次</strong><span v-if="visible('total_quantity')"> · {{ context?.film_quantity ?? '-' }} 张</span>
              </el-text>
            </dd>
          </div>
        </dl>
      </section>
      <DataEmptyState
        v-if="failed"
        state="error"
        title="贴膜记录读取失败"
        :description="failureMessage"
        size="compact"
        action-text="重试"
        @action="load"
      />
      <SectionLoading
        v-else-if="loading && !context"
        text="正在读取客户贴膜资格及记录..."
      />
      <template v-else-if="context">
        <el-alert
          v-if="!phoneId"
          type="warning"
          title="请从综合查询的具体手机详情办理贴膜，此处仅查看历史。"
          :closable="false"
          class="my-4"
        />
        <el-form
          v-if="phoneId && canOfferService"
          class="tf-dialog-form tf-dialog-form--stacked tf-form-layout"
          label-position="top"
          :disabled="freeCompleted || freeSaving || !!pendingFree || checkoutVisible"
          @submit.prevent="submitFree"
        >
          <el-form-item>
            <el-radio-group
              v-model="serviceMode"
              class="tf-state-selector"
              aria-label="办理方式"
            >
              <el-radio-button
                value="free"
                :disabled="freeCompleted || freeSaving || !!pendingFree || checkoutVisible"
              >
                免费
              </el-radio-button>
              <el-radio-button
                value="paid"
                :disabled="freeCompleted || freeSaving || !!pendingFree || checkoutVisible"
              >
                收费
              </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <div class="tf-form-row">
            <el-form-item
              label="服务门店"
              required
              class="tf-form-field--inline"
            >
              <el-select
                v-model="serviceStore"
                placeholder="请选择本次服务门店"
                filterable
                aria-label="服务门店"
              >
                <el-option
                  v-for="store in stores"
                  :key="store.id"
                  :value="Number(store.id)"
                  :label="store.name"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              v-if="serviceMode === 'free'"
              label="耗膜数量"
              required
              class="tf-form-field--inline"
            >
              <el-input-number
                v-model="filmQuantity"
                :min="1"
                :max="1000"
                :controls="false"
                :precision="0"
                aria-label="耗膜数量"
              />
            </el-form-item>
          </div>
          <el-form-item
            v-if="serviceMode === 'free'"
            label="选择商品"
            required
          >
            <SectionLoading
              v-if="freeOptionsLoading"
              text="正在读取适配商品..."
            />
            <DataEmptyState
              v-else-if="freeOptionsFailed"
              state="error"
              title="免费贴膜商品读取失败"
              description="请刷新门店或重试"
              size="compact"
              action-text="重试"
              @action="loadFreeOptions"
            />
            <DataEmptyState
              v-else-if="serviceStore && !freeOptions.length"
              description="当前门店暂无适配的免费贴膜商品"
              size="compact"
            />
            <el-select
              v-else
              v-model="freeAccessoryId"
              filterable
              clearable
              fit-input-width
              popper-class="film-service-product-popper"
              placeholder="选择本次实际使用的品牌或颜色"
              aria-label="选择商品"
            >
              <el-option
                v-for="option in freeOptions"
                :key="option.id"
                :value="option.id"
                :label="freeOptionLabel(option)"
              >
                <span class="film-product-option">
                  <span>{{ freeOptionLabel(option) }}</span>
                  <el-tag
                    type="success"
                    size="small"
                    effect="light"
                  >
                    库存 {{ availableQuantity(option) }}{{ option.unit || '' }}
                  </el-tag>
                  <el-tag
                    v-if="option.sale_price !== null"
                    type="warning"
                    size="small"
                    effect="light"
                  >
                    销售金额 ¥{{ formatAmount(option.sale_price) }}
                  </el-tag>
                </span>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="serviceMode === 'paid'"
            label="选择商品"
            required
          >
            <SectionLoading
              v-if="paidOptionsLoading"
              text="正在读取适配商品库存..."
            />
            <DataEmptyState
              v-else-if="paidOptionsFailed"
              state="error"
              title="收费贴膜商品读取失败"
              description="请刷新门店或重试"
              size="compact"
              action-text="重试"
              @action="loadPaidOptions"
            />
            <DataEmptyState
              v-else-if="serviceStore && !paidOptions.length"
              description="当前门店暂无适配的膜类库存"
              size="compact"
            />
            <el-select
              v-else
              v-model="paidAccessoryId"
              filterable
              clearable
              fit-input-width
              popper-class="film-service-product-popper"
              placeholder="选择本次使用的钢化膜"
              aria-label="选择收费贴膜商品"
            >
              <el-option
                v-for="option in paidOptions"
                :key="option.id"
                :value="option.id"
                :label="paidOptionLabel(option)"
              >
                <span class="film-product-option">
                  <span>{{ paidOptionLabel(option) }}</span>
                  <el-tag
                    type="success"
                    size="small"
                    effect="light"
                  >
                    可售 {{ availableQuantity(option) }}{{ option.unit || '' }}
                  </el-tag>
                  <el-tag
                    v-if="option.sale_price !== null"
                    type="warning"
                    size="small"
                    effect="light"
                  >
                    销售金额 ¥{{ formatAmount(option.sale_price) }}
                  </el-tag>
                </span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-form>
        <el-alert
          v-if="freeError"
          :title="freeError"
          type="error"
          :closable="false"
          class="my-4"
        />
        <el-alert
          v-if="pendingFree && !freeSaving"
          :title="pendingContextMatches ? '办理结果尚未确认，请保持原内容重试，勿另开一单重复办理。' : '上一笔贴膜办理结果尚未确认，请返回原客户的手机记录重试核对。'"
          type="warning"
          :closable="false"
          class="my-4"
        />
        <div v-tf-loading="{ active: loading, text: '正在刷新客户贴膜记录...' }">
          <section
            class="film-history"
            aria-label="贴膜记录"
          >
            <header class="film-history__heading">
              <div class="film-history__title">
                <strong>贴膜记录</strong>
                <span class="film-history__count">{{ historyCounts.all }}</span>
              </div>
              <div class="film-history__controls">
                <el-radio-group
                  v-if="visible('usage_type')"
                  v-model="historyFilter"
                  class="film-history-filter tf-state-selector"
                  aria-label="贴膜记录筛选"
                  @change="changeHistoryFilter"
                >
                  <el-radio-button value="all">
                    全部 {{ historyCounts.all }}
                  </el-radio-button>
                  <el-radio-button value="free">
                    赠送 {{ historyCounts.free }}
                  </el-radio-button>
                  <el-radio-button value="paid">
                    收费 {{ historyCounts.paid }}
                  </el-radio-button>
                </el-radio-group>
                <span
                  v-if="context.data.length"
                  class="film-history-sort tf-control-display tf-control-display--accent"
                  aria-label="排序方式"
                >
                  ↓ 最新优先
                </span>
              </div>
            </header>
            <div
              v-if="!context.data.length"
              class="film-history-empty"
            >
              <DataEmptyState
                description="暂无贴膜记录"
                size="compact"
              />
            </div>
            <div
              v-else
              ref="historyList"
              class="film-history-list tf-scrollbar-hidden"
              aria-label="贴膜历史记录列表"
              @scroll.passive="handleHistoryScroll"
            >
              <article
                v-for="(record, recordIndex) in context.data"
                :key="record.id"
                class="film-history-card"
                :class="visible('usage_type') ? record.items.some(item => item.sale_type === 'sale') ? 'film-history-card--paid' : 'film-history-card--free' : undefined"
              >
                <header class="film-history-card__header tf-scrollbar-hidden">
                  <div
                    v-if="visible('model_name')"
                    class="film-history-device"
                  >
                    <span
                      class="film-history-device__mark"
                      aria-hidden="true"
                    >膜</span>
                    <span class="film-history-device__label">贴膜设备</span>
                    <strong>{{ record.phone_model_name ?? '-' }}</strong>
                    <el-tag
                      v-if="recordIndex === 0"
                      size="small"
                      type="primary"
                      effect="light"
                    >
                      最新
                    </el-tag>
                  </div>
                  <div class="film-history-card__badges">
                    <el-tag
                      v-if="visible('usage_type') && record.items.some(item => item.sale_type === 'sale')"
                      size="small"
                      type="warning"
                      effect="light"
                    >
                      收费
                    </el-tag>
                    <el-tag
                      v-if="visible('usage_type') && record.items.some(item => item.sale_type === 'gift')"
                      size="small"
                      type="success"
                      effect="light"
                    >
                      赠送
                    </el-tag>
                    <div
                      v-if="visible('sequence')"
                      class="film-history-order tf-control-display tf-control-display--accent tf-control-display--compact"
                      :title="record.order_no ?? '-'"
                    >
                      <span class="tf-control-display__text">{{ compactOrderNo(record.order_no) }}</span>
                      <el-button
                        link
                        type="primary"
                        class="film-history-order__copy"
                        :title="`复制单号 ${record.order_no ?? ''}`"
                        :aria-label="`复制单号 ${record.order_no ?? ''}`"
                        @click.stop="copyOrderNo(record.order_no)"
                      >
                        <el-icon><CopyDocument /></el-icon>
                      </el-button>
                    </div>
                  </div>
                </header>
                <dl class="film-history-meta tf-scrollbar-hidden">
                  <div v-if="visible('created_at')">
                    <dt>贴膜时间</dt>
                    <dd>{{ dateTime(record.created_at) }}</dd>
                  </div>
                  <div v-if="visible('distribution')">
                    <dt>服务门店</dt>
                    <dd>{{ record.store_name ?? '-' }}</dd>
                  </div>
                  <div v-if="visible('operator_name')">
                    <dt>办理人</dt>
                    <dd>{{ record.operator_name ?? '-' }}</dd>
                  </div>
                </dl>
                <div class="film-history-products">
                  <div
                    v-for="(item, itemIndex) in record.items"
                    :key="itemIndex"
                    class="film-history-product"
                    :class="visible('usage_type') ? item.sale_type === 'gift' ? 'film-history-product--free' : item.sale_type === 'sale' ? 'film-history-product--paid' : undefined : undefined"
                  >
                    <strong
                      v-if="visible('name')"
                      class="film-history-product__name"
                      :title="item.name ?? undefined"
                    >
                      {{ item.name ?? '-' }}
                    </strong>
                    <div class="film-history-product__details">
                      <el-tag
                        v-if="visible('usage_type')"
                        :type="item.sale_type === 'gift' ? 'success' : item.sale_type === 'sale' ? 'warning' : 'info'"
                        effect="light"
                        size="small"
                      >
                        {{ item.sale_type === 'gift' ? '赠送' : item.sale_type === 'sale' ? '收费' : '未知' }}
                      </el-tag>
                      <span v-if="visible('total_quantity')">本次消耗{{ item.quantity ?? '-' }}{{ item.unit ? ` ${item.unit}` : '' }}</span>
                      <strong
                        v-if="canViewMoney"
                        class="film-history-product__amount"
                      >
                        {{ item.total_amount === null ? '-' : `¥${formatAmount(item.total_amount)}` }}
                      </strong>
                    </div>
                  </div>
                  <span
                    v-if="!record.items.length"
                    class="text-secondary"
                  >
                    -
                  </span>
                </div>
              </article>
              <div
                v-if="loadingMore"
                class="film-history-list__status"
                role="status"
              >
                <InlineLoading
                  text="正在读取更多贴膜记录..."
                  size="small"
                />
              </div>
              <div
                v-else-if="loadMoreFailed"
                class="film-history-list__status"
              >
                <span>加载失败</span>
                <el-button
                  @click="loadNextPage"
                >
                  重试
                </el-button>
              </div>
              <div
                v-else-if="!hasMoreHistory"
                class="film-history-list__status"
              >
                已加载全部记录
              </div>
            </div>
          </section>
        </div>
      </template>
    </template>
    <template
      v-if="allowed && customer && phoneId && canOfferService"
      #footer
    >
      <div class="tf-dialog-actions">
        <el-button
          v-permission="{ permission: ['query:view', 'query:film'], mode: 'all' }"
          type="primary"
          :loading="freeSaving"
          :disabled="freeCompleted || freeSaving || !!pendingFree && !pendingContextMatches || loading || failed || !context || !canStart || !serviceStore || serviceMode === 'free' && (freeOptionsLoading || !filmQuantity || !freeAccessoryId) || serviceMode === 'paid' && (paidOptionsLoading || !paidAccessoryId)"
          @click="start"
        >
          {{ freeCompleted ? '贴膜完成' : serviceMode === 'free' ? pendingFree && !freeSaving ? '重试原贴膜办理' : '确认免费贴膜' : '选择商品并收款' }}
        </el-button>
      </div>
    </template>
    <SalesGoodsCheckoutDialog
      v-if="checkoutVisible && customer && context && allowed"
      v-model="checkoutVisible"
      :initial-customer="customer"
      :film-customer-id="customer.id"
      :film-phone-id="phoneId"
      :film-model-id="context.device?.model_id"
      :film-eligible-for-free="context.eligible_for_free"
      :initial-film-product="paidOptions.find(option => option.id === paidAccessoryId) || null"
      :defaults="{ customer_name: customer.name, customer_phone: visible('customer_phone') ? customer.phone : '', store_id: serviceStore ?? '' }"
      @success="completed"
    />
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { checkoutSale, getFilmProducts, getFilmServiceContext } from '@/api/sales-checkout'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useClipboard } from '@/composables/utils/useClipboard'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { canViewAccessoryField as visible } from '@/components/accessory-field-permissions'
import { getRequestErrorMessage } from '@/utils/api-response'
import { formatAmount, formatDateTime } from '@/utils/format'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'
import type { CustomerOption } from '@/services/customer-options'
import { getStores, type ReferenceRecord } from '@/services/reference-options'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import { createCheckoutKey, isCheckoutSubmissionRejected } from '@/utils/sales-checkout'
import type { CheckoutGoodsOption, FilmServiceContext, SalesCheckoutInput } from '@/types/sales-checkout'

const SalesGoodsCheckoutDialog = defineAsyncComponent(() => import('@/views/sales/page/SalesGoodsCheckoutDialog.vue'))
const props = defineProps<{ modelValue: boolean; customer: Pick<CustomerOption, 'id' | 'name'> & Partial<Pick<CustomerOption, 'phone'>> | null; phoneId?: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const query = usePagePermissions('query')
const allowed = computed(() => query.canView.value && query.hasPermission('film') && visible('customer_name') && (visible('customer_phone') || !!props.phoneId))
const auth = useAuthStore(), notices = useNotification()
const clipboard = useClipboard()
const serviceMode = ref<'free' | 'paid'>('free'), serviceStore = ref<number | null>(null), filmQuantity = ref<number | undefined>(1)
const freeAccessoryId = ref<number | null>(null), freeOptions = ref<CheckoutGoodsOption[]>([])
const paidAccessoryId = ref<number | null>(null), paidOptions = ref<CheckoutGoodsOption[]>([])
const freeOptionsLoading = ref(false), freeOptionsFailed = ref(false), freeCompleted = ref(false)
const paidOptionsLoading = ref(false), paidOptionsFailed = ref(false)
const stores = ref<ReferenceRecord[]>([]), freeSaving = ref(false), freeError = ref(''), pendingFree = ref<SalesCheckoutInput | null>(null)
const pendingContextMatches = computed(() => !pendingFree.value || pendingFree.value.film_service?.customer_id === props.customer?.id && pendingFree.value.film_service?.phone_id === props.phoneId && pendingFree.value.customer_info.name === props.customer?.name)
const canOfferService = computed(() => allowed.value &&
  (['name', 'category', 'usage_type', 'distribution', 'total_quantity', 'unit_price', 'total_price', 'created_at', 'operator_name'] as const).every(visible) &&
  fieldPermissions.isFieldVisible('query_queryview', 'basic_info.model'))
const canStart = computed(() => allowed.value && canOfferService.value && !!props.phoneId && !!serviceStore.value && (serviceMode.value === 'paid' || context.value?.eligible_for_free))
const canViewMoney = computed(() => visible('usage_type') && visible('total_quantity') && visible('unit_price') && visible('total_price'))
const requests = useLatestRequest(), freeOptionRequests = useLatestRequest()
const context = ref<FilmServiceContext | null>(null)
const loading = ref(false), failed = ref(false), failureMessage = ref(''), checkoutVisible = ref(false)
const page = ref(1), pageSize = 10
const historyList = ref<HTMLElement | null>(null)
const loadingMore = ref(false), loadMoreFailed = ref(false)
const hasMoreHistory = computed(() => context.value?.pagination.has_next === true)
const historyFilter = ref<'all' | 'free' | 'paid'>('all')
const historySaleType = computed(() => historyFilter.value === 'free' ? 'gift' : historyFilter.value === 'paid' ? 'sale' : undefined)
const historyCounts = computed(() => ({ all: context.value?.service_count ?? 0, free: context.value?.free_count ?? 0, paid: context.value?.paid_count ?? 0 }))
const availableQuantity = (option: CheckoutGoodsOption) => Math.max(0, Number(option.quantity || 0) - Number(option.serial_quantity || 0))
const freeOptionLabel = (option: CheckoutGoodsOption) => [option.name, option.brand_name, option.color_name].filter(Boolean).join(' · ') || `商品 ${option.id}`
const paidOptionLabel = (option: CheckoutGoodsOption) => [option.name, option.brand_name, option.color_name].filter(Boolean).join(' · ') || `商品 ${option.id}`
const loadFilmOptions = async (freeOnly: boolean) => {
  freeOptionRequests.cancelLatest()
  if (freeOnly) {
    freeOptions.value = []; freeOptionsLoading.value = false; freeOptionsFailed.value = false
  } else {
    paidOptions.value = []; paidOptionsLoading.value = false; paidOptionsFailed.value = false
  }
  const expectedMode = freeOnly ? 'free' : 'paid'
  if (!props.customer || !props.phoneId || !serviceStore.value || !context.value?.device?.model_id || serviceMode.value !== expectedMode) {
    if (freeOnly) freeAccessoryId.value = null
    else paidAccessoryId.value = null
    return
  }
  const request = freeOptionRequests.nextRequest()
  if (freeOnly) freeOptionsLoading.value = true
  else paidOptionsLoading.value = true
  const storeId = Number(serviceStore.value), customerId = props.customer.id, phoneId = props.phoneId
  try {
    const options: CheckoutGoodsOption[] = [], ids = new Set<number>()
    let optionPage = 1, total: number | undefined
    // 页大小仅控制单次响应；按总数完整读取后再发布，避免只展示前100个商品。
    do {
      const response = await getFilmProducts(customerId, { phone_id: phoneId, store_id: storeId, search: '', page: optionPage, page_size: 20,
        ...(freeOnly ? { free_only: true } : {}), search_mode: 'regular' }, request.signal)
      if (!request.isLatest()) return
      const data = response.data, count = data?.pagination?.total
      if (!response.success || !data || !Array.isArray(data.data) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 ||
        total !== undefined && count !== total || options.length + data.data.length > count || !data.data.length && options.length < count) {
        throw new Error('免费贴膜商品分页响应不完整')
      }
      total = count
      for (const option of data.data) {
        if (ids.has(option.id)) throw new Error('免费贴膜商品分页重复，请重试')
        ids.add(option.id); options.push(option)
      }
      optionPage += 1
    } while (options.length < total)
    const available = options.filter(option => availableQuantity(option) > 0)
    if (freeOnly) {
      freeOptions.value = available
      if (!freeOptions.value.some(option => option.id === freeAccessoryId.value)) freeAccessoryId.value = freeOptions.value[0]?.id ?? null
    } else {
      paidOptions.value = available
      if (!paidOptions.value.some(option => option.id === paidAccessoryId.value)) paidAccessoryId.value = paidOptions.value[0]?.id ?? null
    }
  } catch (error) {
    if (request.isLatest() && !freeOptionRequests.isCanceledError(error)) {
      if (freeOnly) { freeOptions.value = []; freeAccessoryId.value = null; freeOptionsFailed.value = true }
      else { paidOptions.value = []; paidAccessoryId.value = null; paidOptionsFailed.value = true }
    }
  } finally {
    if (request.isLatest()) {
      if (freeOnly) freeOptionsLoading.value = false
      else paidOptionsLoading.value = false
    }
  }
}
const loadFreeOptions = () => { if (serviceMode.value === 'free') void loadFilmOptions(true) }
const loadPaidOptions = () => { if (serviceMode.value === 'paid') void loadFilmOptions(false) }
const dateTime = (value: string | null) => value ? formatDateTime(value, TIME_FORMATS.DATETIME) : '-'
const compactOrderNo = (value: string | null) => value && value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-6)}` : value ?? '-'
const copyOrderNo = async (value: string | null) => {
  if (!value) return
  try {
    await clipboard.copy(value)
    notices.success('单号已复制')
  } catch {
    notices.error('复制单号失败，请重试')
  }
}
const requestHistory = (customerId: number, pageNumber: number, signal: AbortSignal) => historySaleType.value
  ? getFilmServiceContext(customerId, pageNumber, pageSize, signal, props.phoneId, historySaleType.value)
  : getFilmServiceContext(customerId, pageNumber, pageSize, signal, props.phoneId)
const load = async () => {
  if (!props.modelValue || !props.customer || !allowed.value) return
  const customerId = props.customer.id, request = requests.nextRequest()
  page.value = 1; loading.value = true; loadingMore.value = false; failed.value = false; loadMoreFailed.value = false
  if (historyList.value) historyList.value.scrollTop = 0
  try {
    const response = await requestHistory(customerId, page.value, request.signal)
    if (!request.isLatest()) return
    const data = response.data
    if (!response.success || !data || data.customer_id !== customerId || typeof data.eligible_for_free !== 'boolean' ||
      !Number.isSafeInteger(data.service_count) || data.service_count < 0 || !Array.isArray(data.data) ||
      data.pagination?.page !== page.value || data.pagination.page_size !== pageSize) throw new Error('贴膜记录响应不完整，请重试')
    if (props.phoneId && (data.device?.phone_id !== props.phoneId || !Number.isSafeInteger(data.device.model_id))) throw new Error('本次手机关联响应不完整，请重新打开详情')
    const validCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    const expectedRecordCount = historyFilter.value === 'free' ? data.free_count : historyFilter.value === 'paid' ? data.paid_count : data.service_count
    if (visible('usage_type') && (!validCount(data.free_count) || !validCount(data.paid_count) || data.free_count + data.paid_count > data.service_count) ||
      data.pagination.total !== expectedRecordCount) throw new Error('贴膜记录分类统计响应无效，请重试')
    const deviceStatisticsValid = props.phoneId
      ? validCount(data.device_service_count) && data.device_service_count <= data.service_count
      : data.device_service_count === null && data.device_film_quantity === null
    const quantityStatisticsValid = !visible('total_quantity') || validCount(data.film_quantity) &&
      (!props.phoneId || validCount(data.device_film_quantity) && data.device_film_quantity <= data.film_quantity)
    if (!deviceStatisticsValid || !quantityStatisticsValid) throw new Error('贴膜统计响应不完整，请重试')
    if (props.phoneId && !stores.value.length) {
      const storeResponse = await getStores({ strictScope: true })
      if (!request.isLatest()) return
      if (!storeResponse.success || !Array.isArray(storeResponse.data)) throw new Error('服务门店读取失败')
      stores.value = storeResponse.data.filter(row => Number(row.status ?? 1) === 1)
    }
    context.value = data
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) {
      context.value = null; failed.value = true; failureMessage.value = getRequestErrorMessage(error, '读取贴膜记录失败，请重试')
    }
  } finally { if (request.isLatest()) loading.value = false }
}
const loadNextPage = async () => {
  if (!props.modelValue || !props.customer || !allowed.value || !context.value || loading.value || loadingMore.value || !hasMoreHistory.value) return
  const nextPage = page.value + 1, customerId = props.customer.id, request = requests.nextRequest()
  loadingMore.value = true; loadMoreFailed.value = false
  try {
    const response = await requestHistory(customerId, nextPage, request.signal)
    if (!request.isLatest()) return
    const data = response.data
    if (!response.success || !data || data.customer_id !== customerId || !Array.isArray(data.data) ||
      data.pagination?.page !== nextPage || data.pagination.page_size !== pageSize) throw new Error('更多贴膜记录响应不完整，请重试')
    const expectedRecordCount = historyFilter.value === 'free' ? data.free_count : historyFilter.value === 'paid' ? data.paid_count : data.service_count
    if (data.pagination.total !== expectedRecordCount) throw new Error('更多贴膜记录分类统计无效，请重试')
    page.value = nextPage
    context.value = { ...context.value, free_count: data.free_count, paid_count: data.paid_count, pagination: data.pagination, data: [...context.value.data, ...data.data] }
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) loadMoreFailed.value = true
  } finally { if (request.isLatest()) loadingMore.value = false }
}
const handleHistoryScroll = (event: Event) => {
  const element = event.currentTarget as HTMLElement | null
  if (element && !loadMoreFailed.value && element.scrollTop + element.clientHeight >= element.scrollHeight - 24) void loadNextPage()
}
const changeHistoryFilter = () => {
  requests.cancelLatest(); failed.value = false; loadingMore.value = false; loadMoreFailed.value = false; page.value = 1
  if (props.modelValue && props.customer && allowed.value) void load()
}
const submitFree = async () => {
  if (serviceMode.value !== 'free' || freeCompleted.value || freeSaving.value || freeOptionsLoading.value || !allowed.value || !canStart.value || !props.customer || !props.phoneId || !context.value || !serviceStore.value || !freeAccessoryId.value || !pendingContextMatches.value) return
  const wasRetrying = !!pendingFree.value
  freeError.value = ''
  if (!Number.isSafeInteger(filmQuantity.value) || Number(filmQuantity.value) < 1 || Number(filmQuantity.value) > 1000) { freeError.value = '请填写1至1000的实际耗膜数量'; return }
  if (!pendingFree.value) {
    const time = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
    pendingFree.value = { request_key: createCheckoutKey(), customer_info: { name: props.customer.name, phone: visible('customer_phone') ? props.customer.phone || '' : '' },
      store_id: serviceStore.value, operator_id: Number(auth.user?.id), phones: [], accessories: [], sale_time: time,
      film_service: { customer_id: props.customer.id, phone_id: props.phoneId, mode: 'free', quantity: Number(filmQuantity.value), accessory_id: Number(freeAccessoryId.value) },
      payment_info: { payment_method: 'cash', payment_channel: null, payment_amount: 0, payment_status: 'success', payment_time: time } }
  }
  freeSaving.value = true
  try {
    const response = await checkoutSale(pendingFree.value)
    if (!response.success || !response.data?.film_service_id || !response.data.order_id || response.data.paid_amount !== 0) throw new Error('办理回执不完整，请重试原请求核对')
    pendingFree.value = null
    freeCompleted.value = true
    notices.success('免费贴膜办理成功')
    page.value = 1; await load()
  } catch (error) {
    if (!wasRetrying && isCheckoutSubmissionRejected(error)) pendingFree.value = null
    freeError.value = getRequestErrorMessage(error, '贴膜办理未确认，请核对后重试')
  } finally { freeSaving.value = false }
}
const start = () => {
  if (freeCompleted.value || !allowed.value || !props.phoneId || !props.customer || !canStart.value || !context.value || loading.value || failed.value || serviceMode.value === 'paid' && (!paidAccessoryId.value || paidOptionsLoading.value)) return
  if (serviceMode.value === 'free') void submitFree()
  else checkoutVisible.value = true
}
const completed = () => { checkoutVisible.value = false; freeCompleted.value = true; page.value = 1; void load() }
const beforeClose = (done: (cancel?: boolean) => void) => { if (!checkoutVisible.value && !freeSaving.value && !pendingFree.value) done() }
const updateVisible = (value: boolean) => { if (!checkoutVisible.value && !freeSaving.value && !pendingFree.value) emit('update:modelValue', value) }
watch([() => props.modelValue, () => props.customer?.id, () => props.customer?.name, () => props.customer?.phone, () => props.phoneId, allowed,
  () => JSON.stringify(fieldPermissions.getHiddenFields('accessories_accessoriesview')),
  () => JSON.stringify(fieldPermissions.getHiddenFields('query_queryview'))], () => {
  requests.cancelLatest(); freeOptionRequests.cancelLatest(); context.value = null; failed.value = loading.value = checkoutVisible.value = false; loadingMore.value = loadMoreFailed.value = false; page.value = 1; historyFilter.value = 'all'
  serviceMode.value = 'free'
  serviceStore.value = pendingContextMatches.value ? pendingFree.value?.store_id ?? null : null
  filmQuantity.value = pendingFree.value?.film_service?.mode === 'free' && pendingContextMatches.value ? pendingFree.value.film_service.quantity : 1
  stores.value = []; freeError.value = ''; freeOptions.value = []; freeAccessoryId.value = null; freeOptionsFailed.value = false; freeCompleted.value = false
  paidOptions.value = []; paidAccessoryId.value = null; paidOptionsFailed.value = false
  freeOptionsLoading.value = false; paidOptionsLoading.value = false
  if (props.modelValue && props.customer && allowed.value) void load()
}, { immediate: true })
watch([serviceStore, () => context.value?.device?.model_id, serviceMode], () => {
  if (serviceMode.value === 'free') void loadFreeOptions()
  else void loadPaidOptions()
})
</script>

<style scoped lang="scss">
@use './styles/film-service-dialog/base.scss';
@use './styles/film-service-dialog/responsive.scss';
</style>
