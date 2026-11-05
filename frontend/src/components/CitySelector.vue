<!-- 公共省、市、县/区选择器；地区数据统一来自 region-options。 -->
<template>
  <div class="city-selector">
    <div
      v-if="!hideProvince"
      class="form-group"
    >
      <label :for="`${controlId}-province`">省份 <span
        v-if="required"
        class="required"
      >*</span></label>
      <el-select
        :id="`${controlId}-province`"
        v-model="selection.province"
        class="form-control"
        placeholder="搜索或选择省份"
        filterable
        :disabled="disabled || provinceDisabled || cityDisabled"
        @change="handleProvinceChange"
      >
        <el-option
          v-for="province in provinces"
          :key="province.code"
          :label="province.name"
          :value="province.code"
        />
      </el-select>
      <div
        v-if="error && !selection.province"
        class="invalid-feedback"
      >
        请选择省份
      </div>
    </div>

    <div
      v-if="!hideCity"
      class="form-group"
    >
      <label :for="`${controlId}-city`">城市 <span
        v-if="required"
        class="required"
      >*</span></label>
      <el-select
        :id="`${controlId}-city`"
        v-model="selection.city"
        class="form-control"
        placeholder="搜索或选择城市"
        filterable
        :disabled="disabled || cityDisabled || !selection.province"
        @change="handleCityChange"
      >
        <el-option
          v-for="city in cities"
          :key="city.code"
          :label="city.name"
          :value="city.name"
        />
      </el-select>
      <div
        v-if="error && !selection.city"
        class="invalid-feedback"
      >
        请选择城市
      </div>
    </div>

    <div
      v-if="showDistrict"
      class="form-group"
    >
      <label :for="`${controlId}-district`">县/区 <span
        v-if="required"
        class="required"
      >*</span></label>
      <el-select
        :id="`${controlId}-district`"
        v-model="selection.district"
        class="form-control"
        placeholder="搜索或选择县/区"
        filterable
        clearable
        :disabled="disabled || districtDisabled || !selection.city"
        @change="emitChange"
      >
        <el-option
          v-for="district in districts"
          :key="district.code"
          :label="district.name"
          :value="district.name"
        />
      </el-select>
      <div
        v-if="error && !selection.district"
        class="invalid-feedback"
      >
        请选择县/区
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import {
  getCities,
  getDistricts,
  getProvinceName,
  normalizeRegion,
  provinces,
  type RegionSelection
} from '@/services/region-options'

interface Props {
  modelValue?: RegionSelection
  required?: boolean
  disabled?: boolean
  provinceDisabled?: boolean
  cityDisabled?: boolean
  districtDisabled?: boolean
  hideProvince?: boolean
  hideCity?: boolean
  showDistrict?: boolean
  error?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({ province: '', city: '', district: '' }),
  required: false,
  disabled: false,
  provinceDisabled: false,
  cityDisabled: false,
  districtDisabled: false,
  hideProvince: false,
  hideCity: false,
  showDistrict: false,
  error: false
})

const emit = defineEmits<{
  'update:modelValue': [value: RegionSelection]
  change: [value: RegionSelection]
}>()

const controlId = useId()
const selection = ref<RegionSelection>({ province: '', city: '', district: '' })
const cities = computed(() => getCities(selection.value.province))
const districts = computed(() => getDistricts(selection.value.province, selection.value.city))

const emitChange = () => {
  const value = { ...selection.value }
  emit('update:modelValue', value)
  emit('change', value)
}

const handleProvinceChange = () => {
  selection.value.city = ''
  selection.value.district = ''
  emitChange()
}

const handleCityChange = () => {
  selection.value.district = ''
  emitChange()
}

// 回显兼容编码和名称，只更新控件，不在打开编辑时改写历史记录。
watch(() => props.modelValue, value => {
  selection.value = normalizeRegion(value)
}, { immediate: true, deep: true })

defineExpose({
  getProvinceName,
  reset: () => { selection.value = { province: '', city: '', district: '' } }
})
</script>

<style lang="scss" scoped>
.city-selector {
  display: flex;
  width: 100%;
  min-width: 0;
  gap: var(--tf-space-4);
  align-items: stretch;

  .form-group {
    flex: 1;
    min-width: 0;
    margin-bottom: 0;

    label {
      display: block;
      margin-bottom: var(--tf-space-2);
      font-weight: 500;
      color: var(--tf-color-neutral-700);
      font-size: var(--tf-type-scale-14);

      .required {
        color: var(--tf-color-red-500);
      }
    }

    .form-control {
      width: 100%;
    }

    .invalid-feedback {
      color: var(--tf-color-red-500);
      font-size: var(--tf-type-scale-12);
      margin-top: var(--tf-space-1);
    }
  }
}

@media (max-width: 767px) {
  .city-selector {
    flex-direction: column;
    gap: var(--tf-space-3);
  }
}
</style>
