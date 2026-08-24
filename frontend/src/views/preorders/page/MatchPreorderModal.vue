<template>
  <MobileDialog
    v-model="dialogVisible"
    title="匹配库存设备"
    width="880px"
    :show-default-footer="false"
    :close-on-click-modal="!submitting"
    destroy-on-close
  >
    <div class="match-preorder-modal">
      <div class="preorder-summary">
        <div class="summary-main">
          <span class="summary-number">{{ preorder.preorder_number }}</span>
          <el-tag :type="Number(preorder.is_new) === 1 ? 'success' : 'info'" size="small">
            {{ Number(preorder.is_new) === 1 ? '全新' : '二手' }}
          </el-tag>
        </div>
        <div class="summary-product">
          {{ productName }}
        </div>
      </div>

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
            <el-empty :description="loading ? '正在查找匹配库存...' : '暂无完全匹配的在库设备'" />
          </template>
          <el-table-column label="选择" width="68" align="center">
            <template #default="{ row }">
              <el-radio
                :model-value="selectedPhoneId"
                :value="row.id"
                :aria-label="`选择 ${row.imei}`"
                @change="selectPhone(row)"
              />
            </template>
          </el-table-column>
          <el-table-column prop="imei" label="IMEI" min-width="138" class-name="identifier-column" />
          <el-table-column prop="serial_number" label="序列号" min-width="126">
            <template #default="{ row }">{{ row.serial_number || '-' }}</template>
          </el-table-column>
          <el-table-column label="商品" min-width="190">
            <template #default="{ row }">
              {{ [row.brand_name, row.model_name, row.color_name, row.memory_size].filter(Boolean).join(' ') }}
            </template>
          </el-table-column>
          <el-table-column prop="store_name" label="店铺" min-width="100">
            <template #default="{ row }">{{ row.store_name || '-' }}</template>
          </el-table-column>
          <el-table-column label="销售价" min-width="96" align="center">
            <template #default="{ row }">
              {{ row.sale_price === null || row.sale_price === undefined ? '-' : `¥${formatPrice(row.sale_price)}` }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="dialog-actions">
        <el-button :disabled="submitting" @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="loading || selectedPhoneId === null"
          @click="submitMatch"
        >
          确定匹配
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

const productName = computed(() => [
  props.preorder.brand_name,
  props.preorder.model_name,
  props.preorder.color_name,
  props.preorder.memory_size
].filter(Boolean).join(' ') || props.preorder.phone_model || '-')

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
    ElMessage.success('预定单已匹配库存设备')
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
