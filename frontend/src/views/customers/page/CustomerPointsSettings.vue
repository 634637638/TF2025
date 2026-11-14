<template>
  <MobileDialog
    :model-value="modelValue"
    title="积分设置"
    :close-on-click-modal="false"
    :show-default-footer="false"
    destroy-on-close
    @update:model-value="close"
  >
    <SectionLoading
      v-if="loading"
      text="正在读取客户积分规则..."
    />
    <el-alert
      v-else-if="failed"
      title="积分设置读取失败，请重试"
      type="error"
      :closable="false"
    />
    <el-form
      v-else-if="form"
      class="tf-form-layout tf-form-grid"
      label-position="top"
      :disabled="saving || !canManage"
      @submit.prevent="save"
    >
      <div class="points-rules-grid tf-form-row tf-form-row--three">
        <el-form-item
          label="自动累计"
          class="points-rule-wide"
        >
          <el-switch
            v-model="form.enabled"
            aria-label="自动累计积分"
          />
        </el-form-item>
        <template
          v-for="source in sources"
          :key="source.value"
        >
          <el-form-item :label="source.label + '累计'">
            <el-switch
              v-model="form[source.include]"
              :disabled="!form.enabled"
              :aria-label="source.label + '参与积分'"
            />
          </el-form-item>
          <el-form-item
            :label="source.label + '每消费100元累计积分'"
            :required="form.enabled && form[source.include]"
          >
            <el-input-number
              v-model="form[source.rate]"
              :disabled="!form.enabled || !form[source.include]"
              :min="1"
              :max="100"
              :precision="0"
              :controls="false"
            />
          </el-form-item>
        </template>
        <el-form-item
          label="积分抵扣"
          class="points-rule-wide"
        >
          <el-switch
            v-model="form.redemption.enabled"
            aria-label="积分抵扣"
          />
        </el-form-item>
        <el-form-item
          label="抵扣1元所需积分"
          :required="form.redemption.enabled"
        >
          <el-input-number
            v-model="pointsPerYuan"
            :min="1"
            :max="1000000"
            :precision="0"
            :controls="false"
            placeholder="待配置"
          />
        </el-form-item>
        <el-form-item
          label="每件商品最高抵扣比例（%）"
          :required="form.redemption.enabled"
        >
          <el-input-number
            v-model="maxPercent"
            :min="1"
            :max="100"
            :precision="0"
            :controls="false"
            placeholder="待配置"
          />
        </el-form-item>
        <el-form-item
          label="可抵扣类型"
          class="points-rule-wide"
          :required="form.redemption.enabled"
        >
          <el-checkbox-group v-model="form.redemption.sources">
            <el-checkbox
              v-for="source in sources"
              :key="source.value"
              :value="source.value"
            >
              {{ source.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <template v-if="form.redemption.sources.includes('accessory')">
          <el-form-item label="全部商品类型">
            <el-switch
              v-model="form.redemption.all_accessory_categories"
              aria-label="允许全部商品类型抵扣"
            />
          </el-form-item>
          <el-form-item
            v-if="!form.redemption.all_accessory_categories"
            label="允许抵扣的商品类型"
            :required="form.redemption.enabled"
          >
            <el-select
              v-model="form.redemption.category_ids"
              multiple
              filterable
              clearable
              placeholder="搜索并选择商品类型"
            >
              <el-option
                v-for="category in categories"
                :key="category.id"
                :value="category.id"
                :label="category.name + (category.status === 1 ? '' : '（已停用）')"
                :disabled="category.status !== 1 && !savedCategoryIds.includes(category.id)"
              />
            </el-select>
          </el-form-item>
        </template>
      </div>
      <el-alert
        v-if="validationMessage"
        :title="validationMessage"
        type="warning"
        :closable="false"
      />
      <el-alert
        title="积分属于客户账户，全店通用；只能使用结算前已有积分。使用抵扣的商品明细和赠品不累计积分。"
        type="info"
        :closable="false"
      />
      <el-alert
        title="商品累计和抵扣规则为后续商品结算预先配置；当前销售入口尚未提供商品积分结算。"
        type="info"
        :closable="false"
      />
    </el-form>
    <template #footer>
      <div class="tf-dialog-actions">
        <el-button
          :disabled="saving"
          @click="close(false)"
        >
          取消
        </el-button>
        <el-button
          v-if="failed"
          :loading="loading"
          @click="load"
        >
          重新读取
        </el-button>
        <el-button
          v-permission="'customers:manage'"
          type="primary"
          :loading="saving"
          :disabled="!canSave"
          @click="save"
        >
          保存设置
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useNotification } from '@/composables/useNotification'
import SectionLoading from '@/components/SectionLoading.vue'
import type { CustomerPointsConfig, CustomerPointsSettingsData } from '@/types/customer-points'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const { canView, canManage } = usePagePermissions('customers')
const notifications = useNotification()
const requests = useLatestRequest()
const form = ref<CustomerPointsConfig | null>(null)
const categories = ref<CustomerPointsSettingsData['categories']>([])
const savedCategoryIds = ref<number[]>([])
const loading = ref(false), saving = ref(false), failed = ref(false)
const sources = [
  { value: 'new', label: '全新手机', include: 'include_new', rate: 'new_points_per_100' },
  { value: 'used', label: '二手手机', include: 'include_used', rate: 'used_points_per_100' },
  { value: 'accessory', label: '配件/商品', include: 'include_accessories', rate: 'accessory_points_per_100' }
] as const
// 数字控件清空为 undefined；接口用 null 明确表示尚未配置，不猜测兑换数值。
const pointsPerYuan = computed({ get: () => form.value?.redemption.points_per_yuan ?? undefined, set: (value: number | undefined) => { if (form.value) form.value.redemption.points_per_yuan = value ?? null } })
const maxPercent = computed({ get: () => form.value?.redemption.max_percent ?? undefined, set: (value: number | undefined) => { if (form.value) form.value.redemption.max_percent = value ?? null } })
const validInteger = (value: number | null, max: number) => value !== null && Number.isInteger(value) && value >= 1 && value <= max
const validationMessage = computed(() => {
  const value = form.value
  if (!value) return ''
  if (value.enabled && !sources.some(source => value[source.include])) return '自动累计启用时，请至少选择一种积分来源'
  if (sources.some(source => !validInteger(value[source.rate], 100))) return '每100元累计积分须为1到100的整数'
  const rule = value.redemption
  if ((rule.points_per_yuan !== null && !validInteger(rule.points_per_yuan, 1000000)) || (rule.max_percent !== null && !validInteger(rule.max_percent, 100))) return '请填写有效兑换比例及最高抵扣比例'
  if (rule.enabled && (!rule.points_per_yuan || !rule.max_percent || !rule.sources.length ||
    (rule.sources.includes('accessory') && !rule.all_accessory_categories && !rule.category_ids.length))) return '启用抵扣前，请填写兑换比例、单件上限和可抵扣范围'
  return ''
})
const canSave = computed(() => props.modelValue && canManage.value && !!form.value && !loading.value && !saving.value && !failed.value && !validationMessage.value)
const load = async () => {
  if (!props.modelValue || !canView.value || saving.value) return
  const request = requests.nextRequest()
  loading.value = true; failed.value = false; form.value = null
  try {
    const response = await unifiedApi.get<CustomerPointsSettingsData>('/customers/points-config', { params: { include_options: 1 }, useCache: false, showLoading: false, signal: request.signal })
    if (!request.isLatest()) return
    if (response.success === false || !response.data?.config?.redemption || !Array.isArray(response.data.categories)) throw new Error('积分规则响应不完整')
    form.value = structuredClone(response.data.config)
    categories.value = response.data.categories
    savedCategoryIds.value = [...response.data.config.redemption.category_ids]
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) failed.value = true
  } finally { if (request.isLatest()) loading.value = false }
}
const close = (value: boolean) => { if (!value && !saving.value) emit('update:modelValue', false) }
const save = async () => {
  if (!canSave.value || !form.value) return
  saving.value = true
  try {
    const response = await unifiedApi.put<CustomerPointsConfig>('/customers/points-config', form.value, { showLoading: false })
    if (response.success === false) return
    notifications.success('积分设置保存成功')
    emit('update:modelValue', false)
  } catch { /* 统一API提供错误提示，保留草稿供重试。 */ }
  finally { saving.value = false }
}
watch(() => [props.modelValue, canView.value] as const, ([open, allowed]) => {
  requests.cancelLatest(); loading.value = false
  if (open && allowed) void load()
  else if (!saving.value) { form.value = null; categories.value = []; savedCategoryIds.value = [] }
}, { immediate: true })
</script>

<style scoped>
.points-rules-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--tf-space-4);
}
.points-rule-wide {
  grid-column: 1 / -1;
}
.points-rules-grid :deep(.el-form-item),
.points-rules-grid :deep(.el-input-number),
.points-rules-grid :deep(.el-select) {
  min-width: 0;
  width: 100%;
}
</style>
