<template>
  <MobileDialog
    :model-value="modelValue"
    title="客户贴膜"
    :show-default-footer="false"
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
      <RecordDescriptions
        :column="2"
        border
      >
        <el-descriptions-item label="客户姓名">
          {{ customer.name }}
        </el-descriptions-item>
        <el-descriptions-item label="手机号">
          {{ customer.phone }}
        </el-descriptions-item>
        <el-descriptions-item label="累计贴膜次数">
          {{ context?.service_count ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item
          v-if="visible('total_quantity')"
          label="累计用膜数量"
        >
          {{ context?.film_quantity ?? '-' }}
        </el-descriptions-item>
      </RecordDescriptions>
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
          :type="context.eligible_for_free ? 'info' : 'warning'"
          :title="context.eligible_for_free ? '有有效手机购买记录，免费贴膜不限原购买门店。' : '当前无免费贴膜资格，可选择收费贴膜。'"
          :closable="false"
          class="my-4"
        />
        <div v-tf-loading="{ active: loading, text: '正在刷新客户贴膜记录...' }">
          <DataEmptyState
            v-if="!context.data.length"
            description="暂无贴膜记录"
            size="compact"
          />
          <RecordDescriptions
            v-for="record in context.data"
            :key="record.id"
            :column="2"
            border
            class="mb-4"
          >
            <el-descriptions-item
              v-if="visible('sequence')"
              label="单号"
              :span="2"
            >
              {{ record.order_no ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="visible('created_at')"
              label="服务时间"
            >
              {{ dateTime(record.business_time) }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="visible('created_at')"
              label="记录时间"
            >
              {{ dateTime(record.created_at) }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="visible('distribution')"
              label="服务门店"
            >
              {{ record.store_name ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="visible('operator_name')"
              label="办理人"
            >
              {{ record.operator_name ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="visible('total_quantity')"
              label="用膜数量"
            >
              {{ record.quantity ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              label="使用商品"
              :span="2"
            >
              <p
                v-for="(item, index) in record.items"
                :key="index"
              >
                <span v-if="visible('name')">{{ item.name ?? '-' }}</span>
                <span v-if="visible('usage_type')"> · {{ item.sale_type === 'gift' ? '免费' : item.sale_type === 'sale' ? '收费' : '-' }}</span>
                <span v-if="visible('total_quantity')"> · {{ item.quantity ?? '-' }}件</span>
                <span v-if="canViewMoney"> · 实收 {{ item.total_amount === null ? '-' : `¥${formatAmount(item.total_amount)}` }}</span>
              </p>
            </el-descriptions-item>
          </RecordDescriptions>
        </div>
        <Pagination
          :current="page"
          :page-size="pageSize"
          :total="context.pagination.total"
          :disabled="loading"
          :show-page-sizes="false"
          @change="changePage"
        />
      </template>
    </template>
    <template
      v-if="allowed && customer && canOfferService"
      #footer
    >
      <div class="tf-dialog-actions">
        <el-button
          v-permission="{ permission: ['accessories:create', 'accessories:gift'] }"
          type="primary"
          :disabled="loading || failed || !context || !canStart"
          @click="start"
        >
          办理贴膜
        </el-button>
      </div>
    </template>
    <SalesGoodsCheckoutDialog
      v-if="checkoutVisible && customer && context && allowed"
      v-model="checkoutVisible"
      :initial-customer="customer"
      :film-customer-id="customer.id"
      :film-eligible-for-free="context.eligible_for_free"
      :defaults="{ customer_name: customer.name, customer_phone: customer.phone }"
      @success="completed"
    />
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { getFilmServiceContext } from '@/api/sales-checkout'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { canViewAccessoryField as visible } from '@/components/accessory-field-permissions'
import { getRequestErrorMessage } from '@/utils/api-response'
import { formatAmount, formatDateTime } from '@/utils/format'
import { TIME_FORMATS } from '@/utils/time'
import type { CustomerOption } from '@/services/customer-options'
import type { FilmServiceContext } from '@/types/sales-checkout'

const SalesGoodsCheckoutDialog = defineAsyncComponent(() => import('@/views/sales/page/SalesGoodsCheckoutDialog.vue'))
const props = defineProps<{ modelValue: boolean; customer: Pick<CustomerOption, 'id' | 'name' | 'phone'> | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const query = usePagePermissions('query'), accessories = usePagePermissions('accessories')
const allowed = computed(() => query.canView.value && query.hasPermission('film') && accessories.canView.value && visible('customer_name') && visible('customer_phone'))
const canOfferService = computed(() => accessories.canCreate.value || accessories.hasPermission('gift'))
const canStart = computed(() => accessories.canCreate.value || context.value?.eligible_for_free && accessories.hasPermission('gift'))
const canViewMoney = computed(() => visible('usage_type') && visible('total_quantity') && visible('unit_price') && visible('total_price'))
const requests = useLatestRequest()
const context = ref<FilmServiceContext | null>(null)
const loading = ref(false), failed = ref(false), failureMessage = ref(''), checkoutVisible = ref(false)
const page = ref(1), pageSize = 20
const dateTime = (value: string | null) => value ? formatDateTime(value, TIME_FORMATS.DATETIME) : '-'
const load = async () => {
  if (!props.modelValue || !props.customer || !allowed.value) return
  const customerId = props.customer.id, request = requests.nextRequest()
  loading.value = true; failed.value = false
  try {
    const response = await getFilmServiceContext(customerId, page.value, pageSize, request.signal)
    if (!request.isLatest()) return
    const data = response.data
    if (!response.success || !data || data.customer_id !== customerId || typeof data.eligible_for_free !== 'boolean' ||
      !Number.isSafeInteger(data.service_count) || data.service_count < 0 || !Array.isArray(data.data) ||
      data.pagination?.page !== page.value || data.pagination.page_size !== pageSize || data.pagination.total !== data.service_count) throw new Error('贴膜记录响应不完整，请重试')
    context.value = data
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) {
      context.value = null; failed.value = true; failureMessage.value = getRequestErrorMessage(error, '读取贴膜记录失败，请重试')
    }
  } finally { if (request.isLatest()) loading.value = false }
}
const changePage = (value: number) => { page.value = value; void load() }
const start = () => { if (allowed.value && props.customer && canStart.value && context.value && !loading.value && !failed.value) checkoutVisible.value = true }
const completed = () => { checkoutVisible.value = false; page.value = 1; void load() }
const beforeClose = (done: (cancel?: boolean) => void) => { if (!checkoutVisible.value) done() }
const updateVisible = (value: boolean) => { if (!checkoutVisible.value) emit('update:modelValue', value) }
watch([() => props.modelValue, () => props.customer?.id, () => props.customer?.name, () => props.customer?.phone, allowed,
  () => JSON.stringify(fieldPermissions.getHiddenFields('accessories_accessoriesview'))], () => {
  requests.cancelLatest(); context.value = null; failed.value = loading.value = checkoutVisible.value = false; page.value = 1
  if (props.modelValue && props.customer && allowed.value) void load()
}, { immediate: true })
</script>
