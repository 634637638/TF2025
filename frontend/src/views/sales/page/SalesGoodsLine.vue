<template>
  <div class="form-section mb-4">
    <el-row :gutter="16">
      <el-col
        :xs="24"
        :sm="12"
      >
        <el-form-item
          label="商品名称"
          required
        >
          <el-select
            ref="goodsSelectRef"
            :model-value="modelValue.option?.id"
            filterable
            remote
            :loading="loading"
            :disabled="disabled || !storeId"
            :remote-method="searchGoods"
            placeholder="检索名称、品牌、条形码或SN"
            @update:model-value="selectGoods"
            @visible-change="openOptions"
            @popup-scroll="handleGoodsScroll"
          >
            <el-option
              v-for="option in options"
              :key="option.id"
              :value="option.id"
              :label="optionLabel(option)"
            />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col
        :xs="12"
        :sm="6"
      >
        <el-form-item label="出库方式">
          <el-select
            :model-value="modelValue.sale_type"
            :disabled="disabled || exchangeQuantity !== undefined"
            @update:model-value="changeType"
          >
            <el-option
              v-if="canCreate"
              label="销售"
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
        :xs="12"
        :sm="6"
      >
        <el-form-item
          label="单价"
          required
        >
          <AmountInput
            :model-value="modelValue.unit_price"
            :min="0"
            :max="99999999.99"
            :disabled="disabled || modelValue.sale_type === 'gift'"
            @update:model-value="patch({ unit_price: $event })"
          />
        </el-form-item>
      </el-col>
      <el-col
        v-if="phones.length"
        :xs="24"
        :sm="12"
      >
        <el-form-item
          label="关联手机"
          required
        >
          <el-select
            :model-value="modelValue.linked_phone_id"
            filterable
            :disabled="disabled"
            placeholder="选择本条商品关联的手机"
            @update:model-value="patch({ linked_phone_id: $event })"
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
      <el-col
        :xs="12"
        :sm="6"
      >
        <el-form-item label="SN模式">
          <el-switch
            :model-value="modelValue.serial_mode"
            :disabled="disabled || !canViewAccessoryField('serial_number')"
            aria-label="销售SN模式"
            @update:model-value="patch({ serial_mode: Boolean($event), serial_numbers: [] })"
          />
        </el-form-item>
      </el-col>
      <el-col
        :xs="12"
        :sm="6"
      >
        <el-form-item
          :label="modelValue.serial_mode ? 'SN数量' : '数量'"
          required
        >
          <el-input-number
            :model-value="modelValue.serial_mode ? modelValue.serial_numbers.length : quantityCleared ? null : modelValue.quantity"
            :min="modelValue.serial_mode ? 0 : 1"
            :max="999999"
            :precision="0"
            :controls="false"
            :disabled="disabled || modelValue.serial_mode || exchangeQuantity !== undefined"
            @update:model-value="updateQuantity"
          />
        </el-form-item>
      </el-col>
      <el-col
        v-if="modelValue.sale_type === 'sale' && canViewAccessoryField('total_price')"
        :xs="12"
        :sm="6"
      >
        <el-form-item label="本条抵扣积分">
          <el-input-number
            :model-value="modelValue.redeem_points ?? 0"
            :min="0"
            :max="2147483647"
            :precision="0"
            :controls="false"
            :disabled="disabled"
            @update:model-value="patch({ redeem_points: $event })"
          />
        </el-form-item>
      </el-col>
      <el-col
        v-if="modelValue.serial_mode"
        :span="24"
      >
        <el-form-item
          label="实际出库SN（每行一件，支持扫码枪输入）"
          required
        >
          <el-input
            v-identifier-input="'accessory-serial-list'"
            :model-value="serialText"
            type="textarea"
            class="tf-textarea"
            :rows="3"
            :disabled="disabled"
            placeholder="输入或粘贴SN，每行一件"
            @update:model-value="inputSerials"
          />
        </el-form-item>
      </el-col>
    </el-row>
    <div class="tf-dialog-toolbar">
      <el-button
        v-if="modelValue.serial_mode"
        :disabled="disabled || !modelValue.option"
        @click="scannerVisible = true"
      >
        扫码SN
      </el-button>
      <el-button
        v-if="exchangeQuantity === undefined"
        type="danger"
        plain
        :disabled="disabled"
        @click="emit('remove')"
      >
        移除此商品
      </el-button>
    </div>
    <OptimizedScanner
      v-if="scannerVisible"
      v-model:visible="scannerVisible"
      scan-type="serial"
      serial-profile="accessory"
      @success="acceptScan"
      @manual="scannerVisible = false"
      @cancel="scannerVisible = false"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useSelectLoadMore } from '@/composables/useSelectLoadMore'
import { getCheckoutGoods, getFilmProducts } from '@/api/sales-checkout'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useGoodsPermissions } from '@/composables/useGoodsPermissions'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useNotification } from '@/composables/useNotification'
import { canViewAccessoryField as canViewStockField, canViewQueryGoodsField, type AccessoryFieldName } from '@/components/accessory-field-permissions'
import { isValidAccessorySerial, normalizeAccessorySerial } from '@/utils/accessory-serial'
import type { CheckoutGoodsDraft, CheckoutGoodsOption, CheckoutPhone } from '@/types/sales-checkout'
const OptimizedScanner = defineAsyncComponent(() => import('@/components/OptimizedScanner.vue'))
const props = withDefaults(defineProps<{ fieldSource?: 'accessories' | 'query'; modelValue: CheckoutGoodsDraft; storeId: number | null; phones: CheckoutPhone[]; disabled: boolean; exchangeQuantity?: number; filmOnly?: boolean; filmModelId?: number; filmCustomerId?: number; filmPhoneId?: number; allowGift?: boolean }>(), { fieldSource: undefined, exchangeQuantity: undefined, filmOnly: false, filmModelId: undefined, filmCustomerId: undefined, filmPhoneId: undefined, allowGift: true })
const effectiveFieldSource = computed(() => props.filmOnly ? 'accessories' : props.fieldSource || permissions.source.value)
const canViewAccessoryField = (field: AccessoryFieldName) => effectiveFieldSource.value === 'query' ? canViewQueryGoodsField(field) : canViewStockField(field)
const emit = defineEmits<{ 'update:modelValue': [value: CheckoutGoodsDraft]; remove: [] }>()
const permissions = useGoodsPermissions()
const queryPermissions = usePagePermissions('query')
const filmAllowed = computed(() => props.filmOnly && !!props.filmCustomerId && !!props.filmPhoneId && queryPermissions.canView.value && queryPermissions.hasPermission('film'))
const canCreate = computed(() => props.filmOnly ? filmAllowed.value : permissions.canCreate.value)
const canGift = computed(() => props.allowGift && (props.filmOnly ? filmAllowed.value : permissions.canGift.value))
const notices = useNotification()
const requests = useLatestRequest()
const rows = ref<CheckoutGoodsOption[]>([])
const page = ref(0), total = ref(0), keyword = ref(''), loading = ref(false), failed = ref(false), scannerVisible = ref(false)
const pageSize = 20
const serialText = ref('')
const quantityCleared = ref(false)
const options = computed(() => props.modelValue.option && !rows.value.some(row => row.id === props.modelValue.option?.id) ? [props.modelValue.option, ...rows.value] : rows.value)
const optionLabel = (option: CheckoutGoodsOption) => [option.name, canViewAccessoryField('brand_name') ? option.brand_name : '', canViewAccessoryField('product_model') ? option.product_model : ''].filter(Boolean).join(' · ')
const patch = (value: Partial<CheckoutGoodsDraft>) => emit('update:modelValue', { ...props.modelValue, ...value })
const updateQuantity = (value: number | null | undefined) => {
  quantityCleared.value = value === null || value === undefined
  patch({ quantity: value ?? 0 })
}
watch(() => [props.modelValue.quantity, props.modelValue.option?.id, props.modelValue.serial_mode], () => {
  if (props.modelValue.quantity > 0) quantityCleared.value = false
})
const load = async (append = false) => {
  if (!props.storeId || (props.filmOnly ? !filmAllowed.value : !permissions.canView.value)) return
  const request = requests.nextRequest()
  const nextPage = append ? page.value + 1 : 1
  loading.value = true; failed.value = false
  try {
    const params = { store_id: props.storeId, search: keyword.value, page: nextPage, page_size: pageSize }
    const response = props.filmOnly && props.filmCustomerId && props.filmPhoneId
      ? await getFilmProducts(props.filmCustomerId, { ...params, phone_id: props.filmPhoneId }, request.signal)
      : await getCheckoutGoods({ ...params, source: effectiveFieldSource.value }, request.signal)
    if (!request.isLatest()) return
    if (!response.data || !Array.isArray(response.data.data) || !Number.isSafeInteger(response.data.pagination?.total)) throw new Error('商品候选响应不完整')
    rows.value = append ? [...rows.value, ...response.data.data] : response.data.data
    total.value = response.data.pagination.total; page.value = nextPage
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) { failed.value = true; notices.error('商品读取失败，请重新搜索或打开下拉列表重试') }
  } finally { if (request.isLatest()) loading.value = false }
}
const reset = () => { requests.cancelLatest(); rows.value = []; page.value = total.value = 0; loading.value = failed.value = false }
const searchGoods = async (value = '') => { reset(); keyword.value = value.trim(); await load() }
const loadMore = async () => { if (!loading.value && !failed.value && rows.value.length < total.value) await load(true) }
const { selectRef: goodsSelectRef, onPopupScroll: handleGoodsScroll } = useSelectLoadMore(
  loadMore, () => loading.value || failed.value || rows.value.length >= total.value
)
const openOptions = (opened: boolean) => { if (opened && !loading.value && (!page.value || failed.value)) void load(page.value > 0) }
const selectGoods = (id: number) => {
  const option = options.value.find(row => row.id === id)
  if (!option) return
  if (props.modelValue.sale_type === 'gift' && !giftPriceAvailable(option)) return
  patch({ option, redeem_points: 0, unit_price: props.modelValue.sale_type === 'gift' ? 0 : option.sale_price === null ? null : Number(option.sale_price), quantity: props.exchangeQuantity ?? 1,
    gift_return_unit_price: props.modelValue.sale_type === 'gift' ? giftReturnPrice(option) : null,
    serial_mode: Number(option.serial_quantity) > 0 && Number(option.serial_quantity) === Number(option.quantity) && canViewAccessoryField('serial_number'), serial_numbers: [] })
}
const giftReturnPrice = (option: CheckoutGoodsOption) => props.exchangeQuantity === undefined && !props.filmOnly && option.sale_price !== null ? Number(option.sale_price) : null
const giftPriceAvailable = (option: CheckoutGoodsOption) => {
  if (props.exchangeQuantity !== undefined || props.filmOnly || option.sale_price !== null && Number.isFinite(Number(option.sale_price))) return true
  notices.error('无法读取赠品零售价，请联系管理员'); return false
}
const changeType = (value: 'sale' | 'gift') => {
  const option = props.modelValue.option
  if (value === 'gift' && option && !giftPriceAvailable(option)) return
  patch({ sale_type: value, redeem_points: 0,
    unit_price: value === 'gift' ? 0 : option?.sale_price === null || !option ? null : Number(option.sale_price),
    gift_return_unit_price: value === 'gift' && option ? giftReturnPrice(option) : null })
}
const parseSerials = (value: string) => value.split(/\r?\n/).filter(serial => serial.trim()).map(normalizeAccessorySerial)
const inputSerials = (value: string) => { serialText.value = value; patch({ serial_numbers: parseSerials(value) }) }
const acceptScan = (value: string) => {
  const serial = normalizeAccessorySerial(value)
  if (!isValidAccessorySerial(serial) || props.modelValue.serial_numbers.includes(serial)) { notices.error('SN格式无效或已录入'); return }
  patch({ serial_numbers: [...props.modelValue.serial_numbers, serial] }); scannerVisible.value = false
}
watch(() => [props.storeId, props.filmModelId, props.filmCustomerId, props.filmPhoneId], () => { reset(); keyword.value = ''; patch({ option: null, redeem_points: 0, serial_numbers: [], quantity: props.exchangeQuantity ?? 1, unit_price: null, gift_return_unit_price: null }) })
watch(() => props.exchangeQuantity, quantity => { if (quantity !== undefined && props.modelValue.quantity !== quantity) patch({ quantity }) })
watch(() => props.modelValue.serial_numbers, serials => {
  if (JSON.stringify(parseSerials(serialText.value)) !== JSON.stringify(serials)) serialText.value = serials.join('\n')
}, { immediate: true })
</script>
