<template>
  <MobileDialog
    v-model="dialogVisible"
    :title="isRematch ? '更换匹配设备' : '匹配库存设备'"
    width="880px"
    :show-default-footer="false"
    :close-on-click-modal="!submitting"
    destroy-on-close
  >
    <div class="match-preorder-modal">
      <div
        v-if="showPreorderSummary"
        class="preorder-summary"
      >
        <div
          v-if="canViewPreorderField('preorder_number') || canViewPreorderField('is_new')"
          class="summary-main"
        >
          <span
            v-if="canViewPreorderField('preorder_number')"
            class="summary-number"
          >{{ preorder.preorder_number }}</span>
          <el-tag
            v-if="canViewPreorderField('is_new')"
            :type="Number(preorder.is_new) === 1 ? 'success' : 'info'"
            size="small"
          >
            {{ Number(preorder.is_new) === 1 ? '全新' : '二手' }}
          </el-tag>
        </div>
        <div
          v-if="productName"
          class="summary-product"
        >
          {{ productName }}
        </div>
      </div>

      <el-alert
        class="match-scope-alert"
        title="选择对应商品绑定匹配"
        type="info"
        :closable="false"
        show-icon
      />

      <div class="table-responsive matchable-table-wrap">
        <el-table
          v-loading="loading"
          :data="phones"
          border
          stripe
          highlight-current-row
          row-key="id"
          class="data-table base-data-table matchable-table"
          @row-click="selectPhone"
        >
          <template #empty>
            <DataEmptyState :description="loading ? '正在查找匹配库存...' : '暂无完全匹配的在库设备'" />
          </template>
          <el-table-column
            label="选择"
            width="68"
            align="center"
          >
            <template #default="{ row }">
              <el-radio
                :model-value="selectedPhoneId"
                :value="row.id"
                aria-label="选择设备"
                @change="selectPhone(row)"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="isRematch"
            label="绑定状态"
            width="92"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.is_current"
                type="warning"
                size="small"
              >
                当前绑定
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewPreorderField('imei')"
            prop="imei"
            label="IMEI"
            min-width="138"
            class-name="identifier-column"
          />
          <el-table-column
            v-if="canViewPreorderField('serial_number')"
            prop="serial_number"
            label="序列号"
            min-width="126"
          >
            <template #default="{ row }">
              {{ row.serial_number || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="showProductField"
            label="商品"
            min-width="190"
          >
            <template #default="{ row }">
              {{ getVisibleProductName(row) || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewPreorderField('matchable_sale_price')"
            label="入库价"
            min-width="96"
            align="center"
          >
            <template #default="{ row }">
              {{ row.purchase_cost === null || row.purchase_cost === undefined ? '-' : `¥${formatPrice(row.purchase_cost)}` }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewPreorderField('store_name')"
            prop="store_name"
            label="店铺"
            min-width="100"
          >
            <template #default="{ row }">
              {{ row.store_name || '-' }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="dialog-actions">
        <el-button
          :disabled="submitting"
          @click="dialogVisible = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="loading || selectedPhoneId === null"
          @click="submitMatch"
        >
          {{ isRematch ? '确认更换' : '确定匹配' }}
        </el-button>
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MobileDialog from '@/components/MobileDialog.vue'
import { preorderApi, type MatchablePhone, type Preorder } from '@/api/preorder'
import { canViewPreorderField } from '../preorder-field-permissions'

const props = defineProps<{
  visible: boolean
  preorder: Preorder
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const phones = ref<MatchablePhone[]>([])
const selectedPhoneId = ref<number | null>(null)
const loading = ref(false)
const submitting = ref(false)
const isRematch = computed(() => props.preorder.status === 'arrived')

const productFieldNames = ['brand_name', 'model_name', 'color_name', 'memory_size'] as const
const showProductField = computed(() => productFieldNames.some(canViewPreorderField))
const getVisibleProductName = (item: Preorder | MatchablePhone) => productFieldNames
  .filter(canViewPreorderField)
  .map(field => item[field])
  .filter(Boolean)
  .join(' ')
const productName = computed(() => getVisibleProductName(props.preorder))
const showPreorderSummary = computed(() => (
  canViewPreorderField('preorder_number') ||
  canViewPreorderField('is_new') ||
  Boolean(productName.value)
))

const formatPrice = (value: number | string) => {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '0.00'
}

const selectPhone = (phone: MatchablePhone) => {
  selectedPhoneId.value = phone.id
}

const loadPhones = async () => {
  loading.value = true
  selectedPhoneId.value = null
  try {
    phones.value = await preorderApi.getMatchablePhones(props.preorder.id)
  } catch (error) {
    phones.value = []
    ElMessage.error('获取可匹配库存失败')
  } finally {
    loading.value = false
  }
}

const submitMatch = async () => {
  if (selectedPhoneId.value === null || submitting.value) return

  submitting.value = true
  try {
    await preorderApi.matchPreorder(props.preorder.id, { phone_id: selectedPhoneId.value })
    ElMessage.success(isRematch.value ? '匹配设备更换成功' : '预定单匹配成功，库存已预留，尚未出库')
    emit('success')
    dialogVisible.value = false
  } catch (error) {
    ElMessage.error('匹配失败，请刷新库存后重试')
    await loadPhones()
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.visible,
  visible => {
    if (visible) {
      loadPhones()
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.match-preorder-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preorder-summary {
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.match-scope-alert {
  margin: 0;
}

.summary-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.summary-number {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.summary-product {
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.matchable-table-wrap {
  max-height: min(52vh, 480px);
  overflow: auto;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 768px) {
  .match-preorder-modal {
    gap: 12px;
  }

  .preorder-summary {
    padding: 10px 12px;
  }

  .matchable-table-wrap {
    max-height: none;
  }

  .dialog-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dialog-actions :deep(.el-button) {
    width: 100%;
    margin: 0;
  }
}
</style>
