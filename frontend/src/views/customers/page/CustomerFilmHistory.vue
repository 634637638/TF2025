<template>
  <section v-if="allowed">
    <el-divider content-position="left">
      贴膜记录
    </el-divider>
    <div class="tf-dialog-toolbar">
      <el-button
        v-permission="{ permission: ['customers:view', 'query:view', 'query:film', 'accessories:view'], mode: 'all' }"
        @click.stop="open = true"
      >
        查看贴膜记录
      </el-button>
    </div>
    <FilmServiceDialog
      v-if="open && customer"
      v-model="open"
      :customer="customer"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { canViewAccessoryField } from '@/components/accessory-field-permissions'
import type { CustomerOption } from '@/services/customer-options'

const FilmServiceDialog = defineAsyncComponent(() => import('@/components/query/FilmServiceDialog.vue'))
const props = defineProps<{ active: boolean; customer: Pick<CustomerOption, 'id' | 'name' | 'phone'> | null }>()
const customers = usePagePermissions('customers'), query = usePagePermissions('query'), accessories = usePagePermissions('accessories')
const open = ref(false)
const allowed = computed(() => props.active && customers.canView.value && query.canView.value && query.hasPermission('film') &&
  accessories.canView.value && Number.isSafeInteger(props.customer?.id) && Number(props.customer?.id) > 0 &&
  !!props.customer?.name?.trim() && !!props.customer?.phone?.trim() &&
  ['customer.name', 'customer.phone'].every(key => fieldPermissions.isFieldVisible('customers_customersview', key)) &&
  canViewAccessoryField('customer_name') && canViewAccessoryField('customer_phone'))

watch(() => [allowed.value, props.customer?.id, props.customer?.name, props.customer?.phone], () => { open.value = false })
</script>
