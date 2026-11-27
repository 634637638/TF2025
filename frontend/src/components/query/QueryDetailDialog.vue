<template>
  <MobileDialog
    v-model="dialogVisible"
    title="设备销售信息"
    width="680px"
    :show-close="true"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    dialog-class="query-detail-dialog"
    :show-default-footer="false"
    :before-close="beforeClose"
    destroy-on-close
    append-to-body
  >
    <QueryDetailContent
      :detail-item="detailItem"
      :can-edit="canEdit"
      :can-delete="canDelete"
      :can-return-to-stock="canReturnToStock"
      @edit="emit('edit')"
      @delete="emit('delete')"
      @return="emit('return')"
      @film="openFilm"
      @order="openOrder"
    />
    <CheckoutOrderDialog
      v-if="orderVisible && saleId && hasCheckoutOrder"
      v-model="orderVisible"
      :sale-id="saleId"
      source="phone"
    />
    <FilmServiceDialog
      v-if="filmVisible"
      v-model="filmVisible"
      :customer="filmCustomer"
      :phone-id="filmPhoneId"
      @success="emit('film-success')"
    />
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import MobileDialog from '@/components/MobileDialog.vue'
import QueryDetailContent from '@/components/query/QueryDetailContent.vue'
import type { QueryItem } from '@/types'
import type { ModelValueProps, UpdateModelValueEmits } from '@/types/component'

interface Props extends ModelValueProps {
  detailItem: QueryItem | null
  canEdit: boolean
  canDelete: boolean
  canReturnToStock: boolean
}

interface Emits extends UpdateModelValueEmits {
  edit: []
  delete: []
  return: []
  'film-success': []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const CheckoutOrderDialog = defineAsyncComponent(() => import('@/components/query/CheckoutOrderDialog.vue'))
const orderVisible = ref(false)
const saleId = computed(() => props.detailItem?.销售信息?.sale_id)
const hasCheckoutOrder = computed(() => props.detailItem?.销售信息?.has_checkout_order === true)
const openOrder = () => { if (query.canView.value && query.hasPermission('goods-view') && saleId.value && hasCheckoutOrder.value) orderVisible.value = true }
const FilmServiceDialog = defineAsyncComponent(() => import('@/components/query/FilmServiceDialog.vue'))
const query = usePagePermissions('query')
const filmVisible = ref(false)
const filmPhoneId = computed(() => fieldPermissions.isFieldVisible('query_queryview', 'basic_info.model') ? Number(props.detailItem?.基本信息.phone_id) || undefined : undefined)
const filmCustomer = computed(() => {
  const customer = props.detailItem?.客户信息
  if (!fieldPermissions.isFieldVisible('query_queryview', 'customer_info.customer_name') ||
    !customer?.customer_id || !customer.customer_name || !customer.customer_phone && !filmPhoneId.value) return null
  return { id: customer.customer_id, name: customer.customer_name, phone: customer.customer_phone || undefined }
})
const openFilm = () => { if (query.canView.value && query.hasPermission('film')) filmVisible.value = true }
const beforeClose = (done: (cancel?: boolean) => void) => { if (!filmVisible.value && !orderVisible.value) done() }
watch(() => [props.modelValue, props.detailItem?.基本信息.phone_id, saleId.value, hasCheckoutOrder.value], () => { filmVisible.value = false; orderVisible.value = false })
watch(() => query.canView.value && query.hasPermission('film'), value => { if (!value) filmVisible.value = false })
watch(() => query.canView.value && query.hasPermission('goods-view'), value => { if (!value) orderVisible.value = false })
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

</script>
