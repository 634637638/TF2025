<template>
  <el-form-item
    v-if="canView('province') || canView('city')"
    label="所在地区"
  >
    <CitySelector
      :model-value="location"
      :show-district="ready ? canView('district') && canView('address') : canView('address')"
      :show-town="ready && canView('district') && canView('town') && canView('address')"
      :show-village="ready && canView('district') && canView('town') && canView('village') && canView('address')"
      :hide-province="!canView('province')"
      :hide-city="!canView('city')"
      :province-disabled="!canEdit('province')"
      :city-disabled="!canEdit('city')"
      :district-disabled="!canEdit(ready ? 'district' : 'address')"
      :town-disabled="!canEdit('town')"
      :village-disabled="!canEdit('village')"
      @change="$emit('change', $event)"
    />
  </el-form-item>
  <el-form-item
    v-if="canView('address')"
    label="详细地址"
  >
    <el-input
      :model-value="detail"
      type="textarea"
      class="tf-textarea"
      :rows="2"
      :placeholder="ready ? '请输入门牌号等详细地址' : '请输入乡镇/街道、村/社区及门牌号'"
      :maxlength="limit"
      show-word-limit
      :disabled="!canEdit('address')"
      @update:model-value="$emit('update:detail', $event)"
    />
    <span
      v-if="!ready"
      class="form-help-text"
    >五级地址尚未启用，当前保留原地址格式；须完成管理员数据库迁移后开放。</span>
  </el-form-item>
</template>

<script setup lang="ts">
import CitySelector from '@/components/CitySelector.vue'
import type { RegionSelection } from '@/services/region-options'

defineProps<{
  location: RegionSelection
  detail: string
  limit: number
  ready: boolean
  canView: (field: string) => boolean
  canEdit: (field: string) => boolean
}>()
defineEmits<{
  change: [value: RegionSelection]
  'update:detail': [value: string]
}>()
</script>
