<template>
  <MobileDialog
    v-if="isMobile"
    v-model="visible"
    :title="`${product.brand} ${product.model} 在库明细`"
    width="600px"
    :force-fullscreen="true"
    :close-on-click-modal="true"
    dialog-class="inventory-result-dialog"
    :show-default-footer="false"
  >
    <div class="inventory-mobile-body">
      <div class="product-header mobile-only">
        <div class="product-info">
          <div class="product-main">
            <span class="brand">{{ product.brand }}</span>
            <span class="model">{{ product.model }}</span>
          </div>
          <div
            v-if="product.color || product.memory"
            class="product-specs"
          >
            <span
              v-if="product.color"
              class="color"
            >{{ product.color }}</span>
            <span
              v-if="product.memory"
              class="memory"
            >{{ product.memory }}</span>
          </div>
          <span
            v-if="!loading"
            class="total-count"
          >共{{ totalCount }}台</span>
        </div>
      </div>

      <SectionLoading
        v-if="loading"
        text="加载中..."
        size="compact"
      />

      <div
        v-else
        class="inventory-list mobile-only"
      >
        <div
          v-for="(item, index) in inventoryData"
          :key="item.id"
          class="inventory-item"
          :class="{ 'priority-item': index === 0 }"
        >
          <div>
            <span
              v-if="index === 0"
              class="table-number-badge"
              title="优先出库"
            ><i class="fas fa-star" /></span>
            <span
              v-else
              class="table-number-badge"
            >{{ index + 1 }}</span>
          </div>

          <div class="item-content">
            <div class="item-header">
              <span class="store-name">{{ item.store_name }}</span>
              <span class="supplier-name">{{ item.supplier_name || '未关联' }}</span>
              <span class="date">{{ item.inventory_date }}</span>
            </div>
            <div class="item-details">
              <span class="identifier-label">序列号</span>
              <span class="identifier-value">{{ getDeviceIdentifier(item) }}</span>
              <span
                class="inventory-age"
                :class="getDaysClass(item.inventory_days)"
              >
                <span class="number">{{ item.inventory_days }}</span>
                <span class="label">天</span>
              </span>
            </div>
          </div>
        </div>

        <DataEmptyState
          v-if="!loading && inventoryData.length === 0"
          description="暂无在库明细"
        />
      </div>
    </div>
  </MobileDialog>

  <MobileDialog
    v-else
    v-model="visible"
    :title="`${product.brand} ${product.model} 在库明细`"
    width="600px"
    :close-on-click-modal="true"
    :modal="false"
    dialog-class="inventory-result-dialog"
    :show-default-footer="false"
  >
    <div class="product-header">
      <div class="product-info">
        <div class="product-main">
          <span class="brand">{{ product.brand }}</span>
          <span class="model">{{ product.model }}</span>
        </div>
        <div
          v-if="product.color || product.memory"
          class="product-specs"
        >
          <span
            v-if="product.color"
            class="color"
          >{{ product.color }}</span>
          <span
            v-if="product.memory"
            class="memory"
          >{{ product.memory }}</span>
        </div>
        <span
          v-if="!loading"
          class="total-count"
        >共{{ totalCount }}台</span>
      </div>
    </div>

    <SectionLoading
      v-if="loading"
      text="加载中..."
      size="compact"
    />

    <div
      v-else
      class="inventory-list"
    >
      <div
        v-for="(item, index) in inventoryData"
        :key="item.id"
        class="inventory-item"
        :class="{ 'priority-item': index === 0 }"
      >
        <div>
          <span
            v-if="index === 0"
            class="table-number-badge"
            title="优先出库"
          ><i class="fas fa-star" /></span>
          <span
            v-else
            class="table-number-badge"
          >{{ index + 1 }}</span>
        </div>

        <div class="item-content">
          <div class="item-header">
            <span class="store-name">{{ item.store_name }}</span>
            <span class="supplier-name">{{ item.supplier_name || '未关联' }}</span>
            <span class="date">{{ item.inventory_date }}</span>
          </div>
          <div class="item-details">
            <span class="identifier-label">序列号</span>
            <span class="identifier-value">{{ getDeviceIdentifier(item) }}</span>
            <span
              class="inventory-age"
              :class="getDaysClass(item.inventory_days)"
            >
              <span class="number">{{ item.inventory_days }}</span>
              <span class="label">天</span>
            </span>
          </div>
        </div>
      </div>

      <DataEmptyState
        v-if="!loading && inventoryData.length === 0"
        description="暂无在库明细"
      />
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { unifiedApi } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { useMobile } from '@/composables/mobile'
import SectionLoading from '@/components/SectionLoading.vue'
import { logger } from '@/utils/logger'
import type { InventoryItem } from '@/types'
import type { ModelValueProps } from '@/types/component'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


interface Product {
  brand_id?: number
  model_id?: number
  color_id?: number
  memory_id?: number
  brand: string
  model: string
  color?: string
  memory?: string
}

interface LongInventoryQueryParams {
  brand_id?: number
  model_id?: number
  color_id?: number
  memory_id?: number
  is_new?: 0 | 1
  purchase_cost?: number | 'null'
}

// Props
interface Props extends ModelValueProps {
  product?: Product
  queryToken?: string
  isNew?: boolean
  purchaseCost?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  queryToken: '',
  isNew: true,
  purchaseCost: null,
  product: () => ({
    brand_id: undefined,
    model_id: undefined,
    color_id: undefined,
    memory_id: undefined,
    brand: '',
    model: '',
    color: '',
    memory: ''
  })
})

// Emits
interface Emits {
  'update:modelValue': [value: boolean]
  authorizationExpired: []
}

const emit = defineEmits<Emits>()

// 响应式数据
const visible = ref(props.modelValue)
const loading = ref(false)
const inventoryData = ref<InventoryItem[]>([])
const { isMobile } = useMobile()

// 计算属性
const totalCount = computed(() => inventoryData.value.length)

watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
  if (newVal) {
    loadData()
  }
})

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})

// 方法
const loadData = async () => {
  loading.value = true
  try {
    const params: LongInventoryQueryParams = {
      brand_id: props.product.brand_id,
      model_id: props.product.model_id,
      color_id: props.product.color_id,
      memory_id: props.product.memory_id,
      is_new: props.isNew ? 1 : 0,
      ...(!props.isNew
        ? { purchase_cost: props.purchaseCost === null ? 'null' : props.purchaseCost }
        : {})
    }

    const requiredSpecIds = [params.brand_id, params.model_id, params.color_id, params.memory_id]
    if (requiredSpecIds.some(id => !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) {
      inventoryData.value = []
      globalNotifications.error('当前报价缺少完整规格，无法查询在库明细')
      return
    }

    const response = await unifiedApi.get('/phones/longest-inventory', {
      params,
      headers: {
        'X-Inventory-Query-Token': props.queryToken
      }
    })

    if (response.success) {
      inventoryData.value = extractResponseData<InventoryItem[]>(response)
    } else {
      inventoryData.value = []
      globalNotifications.error(response.message || '加载在库数据失败')
    }
  } catch (error: unknown) {
    inventoryData.value = []
    const requestError = error as { response?: { status?: number }; status?: number }
    const status = requestError.response?.status ?? requestError.status
    if (status === 401) {
      emit('authorizationExpired')
    } else {
      logger.error('加载在库数据失败:', error)
      globalNotifications.error('在库明细加载失败，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}

if (visible.value) {
  loadData()
}

const getDaysClass = (days = 0) => {
  if (days >= 30) return 'days-critical'
  if (days >= 20) return 'days-warning'
  if (days >= 10) return 'days-caution'
  return 'days-normal'
}

const formatIdentifier = (value?: string | null) => String(value || '').trim()
const isImei = (value?: string | null) => /^\d{15}$/.test(formatIdentifier(value))
const getDeviceIdentifier = (item: InventoryItem) => {
  if (isImei(item.imei)) return formatIdentifier(item.imei) || '未录入'
  return formatIdentifier(item.serial_number) || formatIdentifier(item.imei) || '未录入'
}

</script>

<style scoped lang="scss" src="./styles/inventory-result-dialog/header.scss"></style>
<style scoped lang="scss" src="./styles/inventory-result-dialog/inventory-list.scss"></style>
<style scoped lang="scss" src="./styles/inventory-result-dialog/mobile.scss"></style>
<style scoped lang="scss" src="./styles/inventory-result-dialog/compact.scss"></style>
